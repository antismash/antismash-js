/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

/**
 * An event handler that copies the attribute `data-seq` from the HTML element
 * to the clipboard.
 */
export function copyToClipboard(this: HTMLElement): void {
    const text = $(this).attr("data-seq") || "";
    try {
        navigator.clipboard.writeText(text);
    } catch (e) {
        alert("A browser permissions error occured while trying to copy the sequence to the clipboard");
        return;
    }
    alert("Sequence copied to clipboard");
}

/**
 * Constructs HTML for a consistent clipboard copy element.
 *
 * @param data - the data to be copied to the clipboard.
 * @returns The HTML for the element that will copy the given data to the clipboard.
 */
export function clipboardCopyConstruct(data: string): string {
    return `<span class="clipboard-copy" data-seq="${data}">Copy to clipboard</span>`;
}
