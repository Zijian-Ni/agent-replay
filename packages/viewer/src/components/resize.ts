/**
 * Drag-to-resize panel component.
 * Creates smooth, interactive resize handles between panels.
 */

export function initResizeHandle(
  handleId: string,
  targetPanel: HTMLElement,
  side: "left" | "right",
  minWidth: number,
  maxWidth: number,
): void {
  const handle = document.getElementById(handleId);
  if (!handle || !targetPanel) return;

  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  function onMouseDown(e: MouseEvent): void {
    e.preventDefault();
    isResizing = true;
    startX = e.clientX;
    startWidth = targetPanel.getBoundingClientRect().width;

    handle.classList.add("active");
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e: MouseEvent): void {
    if (!isResizing) return;

    const delta = e.clientX - startX;
    let newWidth: number;

    if (side === "left") {
      // Sidebar: dragging right = wider
      newWidth = startWidth + delta;
    } else {
      // Inspector: dragging left = wider
      newWidth = startWidth - delta;
    }

    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    targetPanel.style.width = `${newWidth}px`;
  }

  function onMouseUp(): void {
    isResizing = false;
    handle.classList.remove("active");
    document.body.style.cursor = "";
    document.body.style.userSelect = "";

    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  handle.addEventListener("mousedown", onMouseDown);

  // Keyboard support: arrow keys to resize
  handle.addEventListener("keydown", (e: KeyboardEvent) => {
    const step = 20;
    const currentWidth = targetPanel.getBoundingClientRect().width;
    let newWidth = currentWidth;

    if (side === "left") {
      if (e.key === "ArrowRight") newWidth += step;
      else if (e.key === "ArrowLeft") newWidth -= step;
      else return;
    } else {
      if (e.key === "ArrowLeft") newWidth += step;
      else if (e.key === "ArrowRight") newWidth -= step;
      else return;
    }

    e.preventDefault();
    newWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
    targetPanel.style.width = `${newWidth}px`;
  });
}
