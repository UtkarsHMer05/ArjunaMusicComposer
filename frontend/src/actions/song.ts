"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/lib/auth";
import { db } from "~/server/db";
import { env } from "~/env";
import AWS from "aws-sdk";

// Configure AWS SDK
const s3 = new AWS.S3({
  accessKeyId: env.AWS_ACCESS_KEY_ID,
  secretAccessKey: env.AWS_SECRET_ACCESS_KEY_ID, // Using your custom env var name
  region: env.AWS_REGION,
});

export async function deleteSong(songId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/auth/sign-in");

  console.log("Attempting to delete song:", songId, "for user:", session.user.id);

  // First, get the song to obtain S3 keys
  const song = await db.song.findUnique({
    where: {
      id: songId,
      userId: session.user.id, // Ensure user owns the song
    },
  });

  if (!song) {
    console.error("Song not found or user doesn't have permission");
    throw new Error("Song not found or you don't have permission to delete it");
  }

  console.log("Found song to delete:", {
    id: song.id,
    title: song.title,
    s3Key: song.s3Key,
    thumbnailS3Key: song.thumbnailS3Key
  });

  // Always delete from database first to ensure the song is removed even if S3 fails
  try {
    console.log("Deleting song from database...");
    await db.song.delete({
      where: {
        id: songId,
        userId: session.user.id,
      },
    });
    console.log("Database deletion completed successfully");
  } catch (dbError) {
    console.error("Database deletion failed:", dbError);
    throw new Error("Failed to delete song from database. Please try again.");
  }

  // Try to delete from S3 bucket after database deletion (best effort)
  try {
    const deletePromises = [];

    if (song.s3Key) {
      console.log("Deleting audio file from S3:", song.s3Key);
      deletePromises.push(
        s3.deleteObject({
          Bucket: env.S3_BUCKET_NAME,
          Key: song.s3Key,
        }).promise().catch((error) => {
          console.warn("Failed to delete audio file from S3:", error);
          return null;
        })
      );
    }

    if (song.thumbnailS3Key) {
      console.log("Deleting thumbnail from S3:", song.thumbnailS3Key);
      deletePromises.push(
        s3.deleteObject({
          Bucket: env.S3_BUCKET_NAME,
          Key: song.thumbnailS3Key,
        }).promise().catch((error) => {
          console.warn("Failed to delete thumbnail from S3:", error);
          return null;
        })
      );
    }

    // Execute S3 deletions (best effort, don't fail if S3 operations fail)
    if (deletePromises.length > 0) {
      console.log("Executing S3 deletions...");
      await Promise.allSettled(deletePromises);
      console.log("S3 deletion attempts completed");
    }
  } catch (s3Error) {
    console.warn("S3 deletion failed, but song was deleted from database:", s3Error);
    // Don't throw error for S3 failures since the song is already deleted from DB
  }

  revalidatePath("/create");
  revalidatePath("/");

  return { success: true };
}

export async function setPublishedStatus(songId: string, published: boolean) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/auth/sign-in");

  await db.song.update({
    where: {
      id: songId,
      userId: session.user.id,
    },
    data: {
      published,
    },
  });

  revalidatePath("/create");
}

export async function renameSong(songId: string, newTitle: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/auth/sign-in");

  await db.song.update({
    where: {
      id: songId,
      userId: session.user.id,
    },
    data: {
      title: newTitle,
    },
  });

  revalidatePath("/create");
}

export async function toggleLikeSong(songId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect("/auth/sign-in");

  const existingLike = await db.like.findUnique({
    where: {
      userId_songId: {
        userId: session.user.id,
        songId,
      },
    },
  });

  if (existingLike) {
    await db.like.delete({
      where: {
        userId_songId: {
          userId: session.user.id,
          songId,
        },
      },
    });
  } else {
    await db.like.create({
      data: {
        userId: session.user.id,
        songId,
      },
    });
  }

  revalidatePath("/");
}
