/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import SmilesDrawer from "smiles-drawer";

export function drawStructure(this: HTMLElement): void {
    const options = {
        height: 200,
        padding: 30,
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
    $(this).click(function(this: HTMLElement, event: JQuery.Event) {
        $(`#${$(this).attr("id")}-modal`).show();
        const target = $(`#${$(this).attr("id")}-modal`).children(".modal-content").children(".smiles-canvas-modal").first();
        if (typeof(target) === "undefined") {
            return;
        }
        const modalOptions = {
            height: (target.height() || 500),
            padding: 30,
            width: ((target.width() || 700) + 80),  // unintuitive, but forces fitting into element
        };
        // again, expand it first
        const modalExpanded: boolean = target.parent().parent().hasClass("expanded");
        if (!modalExpanded) {
            target.parent().css("display", "block");
        }
        const modalSmilesDrawer = new SmilesDrawer.Drawer(modalOptions);
        const modalCanvas: HTMLCanvasElement = target[0] as HTMLCanvasElement;
        SmilesDrawer.parse(modalCanvas.getAttribute("data-smiles"),
                           (tree: string) => modalSmilesDrawer.draw(tree, modalCanvas, "light", false));
        if (!modalExpanded) {
            $(target).parent().removeAttr("style");
        }
        $(`#${$(this).attr("id")}-modal`).children(".modal-content")
            .css("top", `${$(this).position().top - modalOptions.height / 2}px`);
    });
}

export function drawStructures(): void {
  $(".smiles-canvas").each(drawStructure);
  $(".modal-container").off("click").click(() => $(".modal-container").hide());
}
