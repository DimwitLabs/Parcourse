export const PLAYING = 1;

export type Player = {
  loadVideoById(options: { videoId: string; startSeconds?: number }): void;
  getCurrentTime(): number;
  pauseVideo(): void;
  playVideo(): void;
  destroy(): void;
};

type PlayerApi = {
  Player: new (
    host: HTMLElement,
    options: {
      videoId: string;
      playerVars: Record<string, string | number>;
      events: { onReady?: () => void; onStateChange?: (event: { data: number }) => void };
    },
  ) => Player;
};

declare global {
  interface Window {
    YT?: PlayerApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let loading: Promise<PlayerApi> | null = null;

export function playerApi(): Promise<PlayerApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (loading) return loading;

  loading = new Promise<PlayerApi>((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT as PlayerApi);
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return loading;
}
