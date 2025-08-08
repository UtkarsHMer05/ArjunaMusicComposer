"use client";

import { Home, Music } from "lucide-react";
import { usePathname } from "next/navigation";
import { SidebarMenuButton, SidebarMenuItem } from "../ui/sidebar";

export default function SidebarMenuItems() {
  const path = usePathname();

  let items = [
    {
      title: "Home",
      url: "/",
      icon: Home,
      active: false,
    },
    {
      title: "Create",
      url: "/create",
      icon: Music,
      active: false,
    },
  ];

  items = items.map((item) => ({
    ...item,
    active: path === item.url,
  }));

  return (
    <>
      {items.map((item) => (
        <SidebarMenuItem key={item.title}>
          <SidebarMenuButton
            asChild
            isActive={item.active}
            tooltip={item.title}
            className="relative group overflow-hidden transition-all after:absolute after:left-0 after:top-0 after:h-full after:w-0 after:bg-primary/30 after:transition-all hover:after:w-1 data-[active=true]:after:w-1 [&>svg]:transition-transform hover:[&>svg]:translate-x-0.5 hover:[&>svg]:scale-105 data-[active=true]:[&>svg]:translate-x-0.5"
          >
            <a href={item.url} aria-current={item.active ? "page" : undefined}>
              <item.icon />
              <span className="transition-colors group-hover:text-primary">
                {item.title}
              </span>
            </a>
          </SidebarMenuButton>
        </SidebarMenuItem>
      ))}
    </>
  );
}
