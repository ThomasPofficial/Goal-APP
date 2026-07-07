export interface VideoEmbed {
  type: "youtube" | "vimeo";
  id: string;
  url: string;
}

export function extractVideoId(rawUrl: string): VideoEmbed | null {
  const ytMatch = rawUrl.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return {
      type: "youtube",
      id: ytMatch[1],
      url: `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`,
    };
  }
  const vimeoMatch = rawUrl.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) {
    return {
      type: "vimeo",
      id: vimeoMatch[1],
      url: `https://player.vimeo.com/video/${vimeoMatch[1]}`,
    };
  }
  return null;
}
