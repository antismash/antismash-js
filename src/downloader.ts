/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

const PREFIX = {
    svg: "http://www.w3.org/2000/svg",
    xlink: "http://www.w3.org/1999/xlink",
    xmlns: "http://www.w3.org/2000/xmlns/",
};

export const initDownloadButtons = (): void => {
    const buttons = document.querySelectorAll(".download-svg");
    buttons.forEach((button) => {
        button.removeEventListener("click", downloadSvgListener, false);
        button.addEventListener("click", downloadSvgListener, false);
    });
};

function downloadSvgListener(event: Event): boolean {
    if (!event.target) {
        // Something is odd here, allow the event to bubble up.
        return true;
    }
    const button = event.target as HTMLElement;
    const tagId = button.getAttribute("data-tag");
    const filename = button.getAttribute("data-filename");
    if (!tagId || !filename) {
        return false;
    }
    downloadSvg(tagId, filename);
    return false;
}

export const downloadSvg = (id: string, filename: string): void => {
    const svgContainer = document.querySelector(`#${id}`);
    if (!svgContainer) {
        return;
    }

    let origSvg: Element | null;

    if (svgContainer.nodeName === "svg") {
        origSvg = svgContainer;
    } else {
        origSvg = svgContainer.children.item(0);
    }
    if (!origSvg || origSvg.nodeName !== "svg") {
        return;
    }

    const svg = origSvg.cloneNode(true);

    fixupSvg(svg as SVGElement);

    const source = new XMLSerializer().serializeToString(svg);
    const data = `data:image/svg+xml;base64,${btoa(source)}`;

    const a = document.createElement("a");
    a.href = data;
    a.download = filename;

    const clickHandler = (event: Event) => {
        setTimeout(() => {
            event?.target?.removeEventListener("click", clickHandler);
        }, 200);
    };

    a.addEventListener("click", clickHandler, false);

    a.click();
};

function fixupSvg(svg: SVGElement): void {
    if (!svg.hasAttribute("version")) {
        svg.setAttribute("version", "1.1");
    }
    if (!svg.hasAttributeNS(PREFIX.xmlns, "xmlns")) {
        svg.setAttributeNS(PREFIX.xmlns, "xmlns", PREFIX.svg);
    }
    if (!svg.hasAttributeNS(PREFIX.xmlns, "xmlns:xlink")) {
        svg.setAttributeNS(PREFIX.xmlns, "xmlns:xlink", PREFIX.xlink);
    }
    document.body.appendChild(svg);
    styleSvg(svg);
    document.body.removeChild(svg);
}

function setStyle(element: Element, emptySVGStyle: CSSStyleDeclaration): void {
    const computedStyle = getComputedStyle(element);
    let styleString = "";
    for (let i = 0, len = computedStyle.length; i < len; i++) {
        const key = computedStyle[i];
        const value = computedStyle.getPropertyValue(key);

        // Only set non-default styles
        if (value !== emptySVGStyle.getPropertyValue(key)) {
            styleString += `${key}:${value};`;
        }
    }
    element.setAttribute("style", styleString);
}

function walkTree(node: Element, tree: Element[]): void {
    if (!node?.hasChildNodes()) {
        return;
    }
    let child = node.firstChild;
    while (child) {
        if (child.nodeType === Node.ELEMENT_NODE && child.nodeName !== "SCRIPT") {
            tree.push(child as Element);
            walkTree(child as Element, tree);
        }
        child = child.nextSibling;
    }

}

function initTree(element: Element): Element[] {
    const tree: Element[] = [];
    tree.push(element);
    walkTree(element, tree);
    return tree;
}

function styleSvg(element: SVGElement): void {
    const emptySVG = document.createElementNS(PREFIX.svg, "svg");
    document.body.appendChild(emptySVG);
    const emptySVGStyle = getComputedStyle(emptySVG);
    document.body.removeChild(emptySVG);

    const allElements = initTree(element);
    let i = allElements.length;
    while (i--) {
        setStyle(allElements[i], emptySVGStyle);
    }
}
