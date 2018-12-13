/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

/*
    This function can be easily replaced by the Clipboard API when more browsers
    support it, e.g.:
        navigator.clipboard.write(text);
    Firefox 63 is the earliest firefox to support it and debian currently ships 60.
*/
export function copyToClipboard(this: HTMLElement): void {
    // create a temporary element to place the text in
    const textArea = document.createElement("textarea");
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "1px";
    textArea.style.height = "1px";
    // set the value
    textArea.value = $(this).attr("data-seq") || "";
    document.body.appendChild(textArea);
    // cause the browser to select it
    textArea.select();
    // then try to copy it to clipboard
    try {
        document.execCommand("copy");
        alert("Sequence copied to clipboard");
    } finally {
        // ensure that temporary element is always removed
        document.body.removeChild(textArea);
    }
}
