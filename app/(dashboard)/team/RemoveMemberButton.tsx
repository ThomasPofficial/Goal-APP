"use client";

import { useRouter } from "next/navigation";
import { X } from "lucide-react";

interface Props {
  memberId: string;
}

export default function RemoveMemberButton({ memberId }: Props) {
  const router = useRouter();

  async function remove() {
    if (!confirm("Remove this member from your team?")) return;
    await fetch(`/api/team/members/${memberId}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <button
      onClick={remove}
      className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-[#f8717120] hover:bg-[#f8717140] text-[#f87171] flex items-center justify-center transition-all"
      title="Remove from team"
    >
      <X className="w-3 h-3" />
    </button>
  );
}
