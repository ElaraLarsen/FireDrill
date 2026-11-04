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

export const Folder = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /></svg>;
export const Wrench = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3l7.5-7.5a4 4 0 0 0-2-2z" /><path d="M14.5 6.5l3-3" /></svg>;
export const Zap = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M13 2.5L4.5 13.5H12l-1 8 8.5-11H12z" /></svg>;
export const Hammer = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M14 4l6 6-2.5 2.5-6-6z" /><path d="M11.5 6.5L3.5 14.5l3 3 8-8" /><path d="M5 19l2-2" /></svg>;
export const Pen = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></svg>;
export const Gavel = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M13 3.5l7.5 7.5M9.5 7l7.5 7.5M11.3 5.2l-4.1 4.1 7.5 7.5 4.1-4.1z" /><path d="M8.5 13.5L3 19M2.5 21.5h9" /></svg>;
export const Copy = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="8.5" y="8.5" width="12" height="12" rx="2.5" /><path d="M15.5 8.5V6a2.5 2.5 0 0 0-2.5-2.5H6A2.5 2.5 0 0 0 3.5 6v7A2.5 2.5 0 0 0 6 15.5h2.5" /></svg>;
export const CreditCard = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="2.5" /><path d="M2.5 10h19M6.5 15h4" /></svg>;
export const Gauge = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M4.5 18a8.5 8.5 0 1 1 15 0" /><path d="M12 13.5l4-4.5" /><circle cx="12" cy="14" r="1.4" fill="currentColor" /></svg>;
export const Pages = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="6.5" y="3.5" width="12" height="15" rx="2" /><path d="M4 7v12.5A1.5 1.5 0 0 0 5.5 21H15M9.5 8h6M9.5 11.5h6M9.5 15h3.5" /></svg>;
export const Sparkle = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 17l.7 1.8 1.8.7-1.8.7L19 22l-.7-1.8-1.8-.7 1.8-.7z" /></svg>;
export const Hand = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M8 13V5.5a1.5 1.5 0 0 1 3 0V11M11 10V4a1.5 1.5 0 0 1 3 0v6M14 10V5.5a1.5 1.5 0 0 1 3 0V13c0 4.4-2.6 7.5-6.2 7.5-2.4 0-3.7-1.2-5.2-3.4L3.8 14a1.5 1.5 0 0 1 2.5-1.6L8 14.5" /></svg>;
export const Key = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M16.5 6.5l2.5 2.5M14 9l2 2" /></svg>;
export const User = ({ size, ...p }: P) => <svg {...base(size)} {...p}><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" /></svg>;
export const Bot = ({ size, ...p }: P) => <svg {...base(size)} {...p}><rect x="4.5" y="8" width="15" height="11" rx="3" /><path d="M12 4.5V8M9 13h.01M15 13h.01M9.5 16.5h5" /></svg>;
export const Eye = ({ size, ...p }: P) => <svg {...base(size)} {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></svg>;
