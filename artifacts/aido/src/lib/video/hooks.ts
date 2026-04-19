import { useState, useEffect, useMemo } from 'react';

export function useVideoPlayer({ durations }: { durations: Record<string, number> }) {
  const [currentScene, setCurrentScene] = useState(0);
  
  // Stable reference to scene keys and durations
  const sceneKeys = useMemo(() => Object.keys(durations), [durations]);
  const durationValues = useMemo(() => Object.values(durations), [durations]);

  useEffect(() => {
    // @ts-ignore
    window.startRecording?.();
    
    let isSubscribed = true;
    let currentTimeout: ReturnType<typeof setTimeout>;

    const playScene = (index: number) => {
      if (!isSubscribed) return;
      
      setCurrentScene(index);
      
      const sceneDuration = durationValues[index];
      
      currentTimeout = setTimeout(() => {
        if (index < sceneKeys.length - 1) {
          playScene(index + 1);
        } else {
          // End of video pass
          // @ts-ignore
          window.stopRecording?.();
          // Loop back to start
          playScene(0);
        }
      }, sceneDuration);
    };

    playScene(0);

    return () => {
      isSubscribed = false;
      clearTimeout(currentTimeout);
    };
  }, [sceneKeys, durationValues]);

  return { currentScene };
}