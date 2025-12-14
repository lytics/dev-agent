/**
 * Utility functions for file and UI icons
 */

/**
 * Get file icon based on extension
 */
export function getFileIcon(filePathOrExt: string): string {
  // Extract extension (handle both full paths and just extensions)
  const ext = filePathOrExt.includes('.') ? filePathOrExt.split('.').pop() || '' : filePathOrExt;

  const iconMap: Record<string, string> = {
    ts: '📘',
    tsx: '⚛️',
    js: '📜',
    jsx: '⚛️',
    go: '🐹',
    py: '🐍',
    rs: '🦀',
    md: '📝',
    json: '📋',
    yaml: '⚙️',
    yml: '⚙️',
  };

  return iconMap[ext] || '📄';
}
