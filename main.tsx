import React from "react";
import { User } from "../types";
import { User as UserIcon } from "lucide-react";

interface UserAvatarProps {
  user?: User | null;
  name?: string;
  avatarUrl?: string;
  avatarIcon?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export const PRESET_AVATAR_ICONS = [
  "⛽", "👷", "👨‍💼", "👩‍💼", "👤", "🛡️", "⭐", "⚡", "🏅", "🚗", "🔧", "🏁"
];

export const getAvatarBgClass = (name: string = "") => {
  const colors = [
    "bg-indigo-600 text-white",
    "bg-emerald-600 text-white",
    "bg-amber-600 text-white",
    "bg-sky-600 text-white",
    "bg-purple-600 text-white",
    "bg-rose-600 text-white",
    "bg-teal-600 text-white",
    "bg-fuchsia-600 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  user,
  name,
  avatarUrl,
  avatarIcon,
  size = "md",
  className = "",
}) => {
  const finalName = user?.nomeCompleto || name || "Funcionário";
  const finalUrl = user?.avatarUrl || avatarUrl;
  const finalIcon = user?.avatarIcon || avatarIcon;

  const initials = finalName
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "F";

  const sizeClasses = {
    xs: "w-5 h-5 text-[9px]",
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-base",
    xl: "w-16 h-16 text-xl",
  };

  const currentSize = sizeClasses[size] || sizeClasses.md;

  if (finalUrl) {
    return (
      <img
        src={finalUrl}
        alt={finalName}
        className={`${currentSize} rounded-full object-cover border border-slate-200/80 shadow-sm shrink-0 ${className}`}
        onError={(e) => {
          // If image load fails, hide image element
          (e.target as HTMLElement).style.display = "none";
        }}
      />
    );
  }

  if (finalIcon) {
    return (
      <div
        className={`${currentSize} rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center shrink-0 shadow-sm ${className}`}
        title={finalName}
      >
        <span>{finalIcon}</span>
      </div>
    );
  }

  return (
    <div
      className={`${currentSize} rounded-full ${getAvatarBgClass(
        finalName
      )} flex items-center justify-center font-extrabold shrink-0 shadow-sm ${className}`}
      title={finalName}
    >
      <span>{initials}</span>
    </div>
  );
};
