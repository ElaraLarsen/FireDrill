import { Composition } from "remotion";
import { EXPLAINER_DURATION, FireDrillExplainer } from "./Explainer";
import { FPS, FireDrillTrailer, TRAILER_DURATION } from "./Trailer";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="FireDrillExplainer" component={FireDrillExplainer} durationInFrames={EXPLAINER_DURATION} fps={FPS} width={1920} height={1080} />
      <Composition id="FireDrillTrailer" component={FireDrillTrailer} durationInFrames={TRAILER_DURATION} fps={FPS} width={1920} height={1080} />
    </>
  );
};
