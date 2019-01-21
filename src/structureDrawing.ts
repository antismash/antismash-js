/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import SmilesDrawer from "smiles-drawer";

export function drawStructure(this: HTMLElement): void {
    const options = {
        height: 200,
        width: ($(this).parent().width() || 270) - 20,
    };
    // SmilesDrawer can't cope with drawing while hidden, so display
    // the element if it's hidden, draw it, then hide it again
    const expanded: boolean = $(this).parent().parent().hasClass("expanded");
    if (!expanded) {
        $(this).parent().css("display", "block");
    }
    const smilesDrawer = new SmilesDrawer.Drawer(options);
    const canvas: HTMLCanvasElement = this as HTMLCanvasElement;
    SmilesDrawer.parse(canvas.getAttribute("data-smiles"),
                       (tree: string) => smilesDrawer.draw(tree, canvas, "light", false));
    if (!expanded) {
        $(this).parent().removeAttr("style");
    }
}

export function drawStructures(): void {
  $(".smiles-canvas").each(drawStructure);
}
