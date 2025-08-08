"use client";

import type { Category, Like, Song } from "@prisma/client";
import { Heart, Loader2, Music, Play, MoreHorizontal, Trash2 } from "lucide-react";
import { useState } from "react";
import { getPlayUrl } from "~/actions/generation";
import { toggleLikeSong, deleteSong } from "~/actions/song";
import { usePlayerStore } from "~/stores/use-player-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { toast } from "sonner";

type SongWithRelation = Song & {
  user: { name: string | null };
  _count: {
    likes: number;
  };
  categories: Category[];
  thumbnailUrl?: string | null;
  likes?: Like[];
};

export function SongCard({
  song,
  currentUserId
}: {
  song: SongWithRelation;
  currentUserId?: string;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const setTrack = usePlayerStore((state) => state.setTrack);
  const requestAutoplay = usePlayerStore((s) => s.requestAutoplay);
  const [isLiked, setIsLiked] = useState(
    song.likes ? song.likes.length > 0 : false,
  );
  const [likesCount, setLikesCount] = useState(song._count.likes);

  const handlePlay = async () => {
    setIsLoading(true);
    const playUrl = await getPlayUrl(song.id);

    // Mark that this selection was user-initiated and should attempt autoplay
    requestAutoplay();

    setTrack({
      id: song.id,
      title: song.title,
      url: playUrl,
      artwork: song.thumbnailUrl,
      prompt: song.prompt,
      createdByUserName: song.user.name,
    });

    setIsLoading(false);
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();

    setIsLiked(!isLiked);
    setLikesCount(isLiked ? likesCount - 1 : likesCount + 1);

    await toggleLikeSong(song.id);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();

    const confirmed = window.confirm(
      `Are you sure you want to delete "${song.title}"? This action cannot be undone and will remove the song from both the database and cloud storage.`
    );

    if (!confirmed) return;

    setIsDeleting(true);
    try {
      await deleteSong(song.id);
      toast.success(`"${song.title}" has been deleted successfully`);
      // The page will refresh automatically due to revalidatePath in the action
    } catch (error) {
      console.error("Error deleting song:", error);
      toast.error("Failed to delete song. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  // Check if current user is the owner of the song
  const isOwner = currentUserId === song.userId;

  return (
    <div>
      <div onClick={handlePlay} className="cursor-pointer">
        <div className="group relative aspect-square w-full overflow-hidden rounded-md bg-gray-200 group-hover:opacity-75">
          {song.thumbnailUrl ? (
            <img
              className="h-full w-full object-cover object-center"
              alt={song.title}
              src={song.thumbnailUrl}
            />
          ) : (
            <div className="bg-muted flex h-full w-full items-center justify-center">
              <Music className="text-muted-foreground h-12 w-12" />
            </div>
          )}

          {/* Loader */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 transition-transform group-hover:scale-105">
              {isLoading ? (
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              ) : (
                <Play className="h-6 w-6 fill-white text-white" />
              )}
            </div>
          </div>

          {/* Owner Actions - Only show for song owner */}
          {isOwner && (
            <div className="absolute top-2 right-2 flex items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              {/* Quick delete button */}
              <Button
                aria-label="Delete song"
                title="Delete"
                variant="ghost"
                size="sm"
                className="h-8 w-8 bg-black/60 p-0 text-white hover:bg-black/80"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-red-400" />
                )}
              </Button>

              {/* Existing menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 bg-black/60 p-0 text-white hover:bg-black/80"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem
                    onClick={handleDelete}
                    className="text-red-600 focus:text-red-600"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    {isDeleting ? "Deleting..." : "Delete"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>

        <div className="flex items-start justify-between mt-2">
          <div className="flex-1 min-w-0">
            <h3 className="truncate text-sm font-medium text-gray-900">
              {song.title}
            </h3>
            <p className="text-xs text-gray-500">{song.user.name}</p>
          </div>
        </div>

        <div className="mt-1 flex items-center justify-between text-xs text-gray-900">
          <span>{song.listenCount} listens</span>
          <button
            onClick={handleLike}
            className="flex cursor-pointer items-center gap-1"
          >
            <Heart
              className={`h-4 w-4 ${isLiked ? "fill-red-500 text-red-500" : ""}`}
            />
            {likesCount} likes
          </button>
        </div>
      </div>
    </div>
  );
}
