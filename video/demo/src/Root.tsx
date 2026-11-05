import { Composition } from "remotion";
import { DURATION, FPS, FireDrillDemo } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="FireDrillDemo" component={FireDrillDemo} durationInFrames={DURATION} fps={FPS} width={1920} height={1080} />
    </>
  );
};
