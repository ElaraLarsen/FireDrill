// Small inline icons (stroke = currentColor), so the dashboard needs no icon package or network.
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = (size = 16): SVGProps<SVGSVGElement> => ({
  width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
  strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
});

export const Play = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" /></svg>;
export const Pause = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none" /></svg>;
export const StepBack = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M18 5v14L8 12z" fill="currentColor" stroke="none" /><path d="M6 5v14" /></svg>;
export const StepFwd = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 5v14l10-7z" fill="currentColor" stroke="none" /><path d="M18 5v14" /></svg>;
export const Restart = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v5h5" /></svg>;
export const Check = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
export const Cross = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const Lock = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>;
export const Unlock = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 7.6-1.7" /></svg>;
export const Merge = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="12" r="2" /><path d="M6 7v10M6 9c0 2 2 3 5 3h5" /></svg>;
export const Shield = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.3-7.5 9.5-4.3-1.2-7.5-4.9-7.5-9.5V6z" /></svg>;
export const Info = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.5v.5" /></svg>;
export const Chevron = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M9 6l6 6-6 6" /></svg>;
export const Branch = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><circle cx="18" cy="7" r="2" /><path d="M6 7v10M18 9c0 4-4 4-10 7" /></svg>;
export const Flame = ({ size, ...p }: P) => (
  <svg {...base(size)} {...p}>
    <path d="M12 2.5c.8 3.2 4.6 4.9 4.6 9.6A4.6 4.6 0 0 1 12 16.7a4.6 4.6 0 0 1-4.6-4.6c0-2 .9-3.3 1.8-4.4.3 1.4 1 2.3 2 2.6C11 7.8 10.8 5.2 12 2.5z" fill="currentColor" stroke="none" />
    <path d="M5 20.5h14" />
  </svg>
);
