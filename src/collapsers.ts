/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

export function toggleCollapser(element: JQuery<HTMLElement>): void {
    element.toggleClass("expanded");
    if (element.hasClass("expanded")) {
        element.next().css("display", "block");
    } else {
        element.next().removeAttr("style");
    }
}

export function toggleCollapserHandler(this: HTMLElement, event: JQuery.Event): void {
    toggleCollapser($(this));
}
