export const barnModelPointer = {
  suppressGroundClick: false,
};

export function markGizmoEvent(e: { stopPropagation: () => void }) {
  e.stopPropagation();
  barnModelPointer.suppressGroundClick = true;
}
