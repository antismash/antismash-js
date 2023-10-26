/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {event as d3event, select as d3select} from "d3-selection";
import {locusToFullId} from "./viewer.js";

interface IModuleDomain {
    readonly name: string;
    readonly special: boolean;
    readonly modifier: boolean;
    readonly cds: string;
    readonly description: string;
    readonly inactive: boolean;
    readonly terminalDocking: string;
    level: number;  // used for modification domain height stepping/ziggurat
    x: number;  // SVG X coordinate of the domain center
    y: number;  // SVG Y coordinate of the domain center
    radius: number;  // SVG sizing, radius for circular domains and "available space" for others
}

interface IGene {
    readonly name: string;
    readonly start: number;
    readonly end: number;
    scale: number;  // font size for arrow text, initially unset
}

interface IModule {
    readonly domains: IModuleDomain[];
    readonly polymer: string;
    readonly complete: boolean;
    readonly iterative: boolean;
    readonly nonElongating?: boolean;
    completeNumber: number; // the (1-)index of this module when only complete modules are counted
    number: number; // the (1-)index of this module when all modules are counted
    start: number; // SVG X coordinate start position of the module line
    end: number; // SVG X coordinate end position of the module line
}

interface ILegendOptions {
    showNonElongating?: boolean;
}

/* misc dimensions for the purposes of drawing */
const radius = 15;
const modifierDY = -radius;
const modifierDX = pythagoras(0, modifierDY, 2 * radius) - radius;
const specialRadius = 6;
const interModuleGap = radius / 3;
const interGeneGap = radius * 2;
const geneFontSize = 16;
const minFontSize = 10;
const arrowHeight = 20;
const arrowHeadWidth = 20;

let regionCandidates: any = null;  // global storage for results within a region

/**
 * A helper function for calculating the length of a given/missing side of a right-angle triangle.
 * Especially useful for calculating the correct X/Y steps of domains of fixed size.
 *
 * The first parameter that has a value of zero is the one that is calculated,
 * using the values of the other two.
 *
 * @param a - the length of the first side
 * @param b - the length of the second side
 * @param hyp - the hypotenuse
 * @returns The length of the unknown side.
 */
function pythagoras(a: number, b: number, hyp: number): number {
    if (a === 0) {
        return Math.round(Math.sqrt(hyp * hyp - b * b));
    }
    if (b === 0) {
        return Math.round(Math.sqrt(hyp * hyp - a * a));
    }
    return Math.round(Math.sqrt(a * a + b * b));
}

/**
 * Adds the SVG elements that will draw the given domain to the given group
 *
 * @param group - the SVG group element to add the dmoain to
 * @param domain - the specific domain to add
 */
function drawTerminalDocking(group: any, domain: any) {
    const d = domain;
    let top = d.y - specialRadius * 1.5;
    let bottom = d.y + specialRadius * 1.5;
    let left = d.x - specialRadius;
    let right = left + 2 * specialRadius;
    const thickness = specialRadius - 1;
    // draw the chevron
    group.append("polygon")
        .attr("class", "bubble-domain-terminal-docking")
        .attr("points", `${left},${top} ${left + thickness},${d.y} ${left},${bottom} ${left + thickness},${bottom} ${right},${d.y} ${left + thickness},${top} ${left},${top}`);
    // draw the stem, making it touch the previous/next domain as appropriate
    if (domain.terminalDocking === "end") {
        left = d.x - specialRadius;
        right = d.x;
    } else {
        left = d.x;
        right = d.x + specialRadius;
    }
    top = d.y - specialRadius / 3;
    bottom = d.y + specialRadius / 3;
    group.append("polygon")
        .attr("class", "bubble-domain-terminal-docking")
        .attr("points", `${left},${top} ${right},${top} ${right},${bottom} ${left},${bottom} ${left},${top}`);
    return group;
}

/**
 * Draws the legend for the visualisation
 *
 * @param anchor - the region's anchor string (e.g. 'r1c4')
 * @param options - an object containing the options for drawing
 */
function drawLegend(anchor: string, options: ILegendOptions): void {
    const id = "bubble-legend";
    // if it already exists, just move it to the current region
    if ($(`#${id}`).length) {
        $(`#${id}`).detach().appendTo(`#${anchor}-bubble-legend`);
        return;
    }

    const iconHeight = radius * 2 + 4;
    const iconWidth = radius * 2 + 4;
    const center = radius + 2;
    const legend = d3select(`#${anchor}-bubble-legend`).append("div")
      .attr("id", id);

    // standard domains
    legend.append("div").attr("class", "bubble-legend-icon").append("svg")
      .attr("width", iconWidth)
      .attr("height", iconHeight)
      .append("circle")
        .attr("class", "jsdomain-other module-bubble")
        .attr("cx", center)
        .attr("cy", center)
        .attr("r", radius);
    legend.append("div")
      .attr("class", "bubble-legend-text")
      .text("Domain in a complete module");

    // special domains
    legend.append("div").attr("class", "bubble-legend-icon").append("svg")
      .attr("width", iconWidth)
      .attr("height", iconHeight)
      .append("circle")
        .attr("class", "jsdomain-other module-bubble")
        .attr("cx", center)
        .attr("cy", center)
        .attr("r", specialRadius);
    legend.append("div")
      .attr("class", "bubble-legend-text")
      .text("Special domain (e.g. trans-AT docking domains)");

    // example domain in incomplete modules
    legend.append("div").attr("class", "bubble-legend-icon").append("svg")
      .attr("width", iconWidth)
      .attr("height", iconHeight)
      .append("circle")
        .attr("class", "jsdomain-other module-bubble")
        .attr("cx", center)
        .attr("cy", center)
        .attr("r", radius)
        .style("opacity", "50%");
    legend.append("div")
      .attr("class", "bubble-legend-text")
      .text("Domain in an incomplete module or outside modules");

    // terminal docking domains, both N/start and C/end
    drawTerminalDocking(legend.append("div").attr("class", "bubble-legend-icon").append("svg").attr("width", iconWidth).attr("height", iconHeight),
                        {x: iconWidth / 2, y: iconHeight / 2, terminalDocking: "start"})
        .style("opacity", "50%"); // match incomplete modules, which these domains always are
    legend.append("div")
      .attr("class", "bubble-legend-text")
      .text("N-terminal docking domains");

    drawTerminalDocking(legend.append("div").attr("class", "bubble-legend-icon").append("svg").attr("width", iconWidth).attr("height", iconHeight),
                        {x: iconWidth / 2, y: iconHeight / 2, terminalDocking: "end"})
        .style("opacity", "50%"); // match incomplete modules, which these domains always are
    legend.append("div")
      .attr("class", "bubble-legend-text")
      .text("C-terminal docking domains");

    // inactive marker
    const crossManhattan = Math.floor(Math.sqrt((radius * radius) / 2));
    const upper = center + crossManhattan;
    const lower = center - crossManhattan;
    const inactives = legend.append("div").attr("class", "bubble-legend-icon").append("svg")
      .attr("width", iconWidth)
      .attr("height", iconHeight)
      .append("g").attr("class", "bubble-domain-inactive");
    inactives.append("line")
      .attr("x1", lower).attr("y1", lower)
      .attr("x2", upper).attr("y2", upper);
    inactives.append("line")
      .attr("x1", lower).attr("y1", upper)
      .attr("x2", upper).attr("y2", lower);
    legend.append("div")
      .attr("class", "bubble-legend-text")
      .text("Marks domains that are predicted to be inactive");

    // gene arrow
    legend.append("div").attr("class", "bubble-legend-icon").append("svg")
      .attr("width", radius * 4)
      .attr("height", iconHeight)
      .append("polygon")
        .attr("class", "bubble-gene-arrow")
        .attr("points", geneArrow(radius / 3, radius * 4 - radius / 3, center));
    legend.append("div")
      .attr("class", "bubble-legend-text")
      .text("The gene/CDS feature containing the domains");

    // module labels and products
    const moduleLabel = legend.append("div").attr("class", "bubble-legend-icon").append("svg")
      .attr("width", radius * 3)
      .attr("height", iconHeight)
      .append("g").attr("class", "bubble-module-label");
    moduleLabel.append("line")
      .attr("x1", 2)
      .attr("x2", radius * 3 - 2)
      .attr("y1", 4)
      .attr("y2", 4)
      .attr("class", "bubble-module-line");
    moduleLabel.append("text")
      .attr("x", radius * 1.75)
      .attr("y", radius * 1.75)
      .attr("class", "bubble-module-text")
      .attr("text-anchor", "middle")
      .text(`M #`);
    legend.append("div")
      .attr("class", "bubble-legend-text")
      .text("The extent of a module, with the module number and the predicted monomer for that module");

    if (options.showNonElongating) {
        const nonElongating = legend.append("div").attr("class", "bubble-legend-icon bubble-legend-non-elongating").append("svg")
          .attr("width", radius * 3)
          .attr("height", iconHeight)
          .append("g").attr("class", "bubble-module-label");
        nonElongating.append("line")
          .attr("x1", 2)
          .attr("x2", radius * 3 - 2)
          .attr("y1", 4)
          .attr("y2", 4)
          .attr("class", "bubble-module-line-non-elongating");
        nonElongating.append("text")
          .attr("x", radius * 1.75)
          .attr("y", radius * 1.75)
          .attr("class", "bubble-module-text")
          .attr("text-anchor", "middle")
          .text(`M #`);

        legend.append("div")
          .attr("class", "bubble-legend-text bubble-legend-non-elongating")
          .text("The extent of a module predicted to be non-elongating, though modification domains may still apply");
    }

    // interative module lines
    const iterativeLabel = legend.append("div").attr("class", "bubble-legend-icon").append("svg")
      .attr("width", radius * 6)
      .attr("height", radius * 2.75)
      .attr("viewbox", `0 0 ${radius * 6} ${radius * 4}`)
      .attr("transform", `scale(${iconHeight / (radius * 3.5)} ${iconHeight / (radius * 3.5)})`)
      .append("g").attr("class", "bubble-module-label");
    drawModuleLine(iterativeLabel, {
        complete: true,
        completeNumber: 1,
        domains: [],
        end: radius * 6 - 2,
        iterative: true,
        number: 1,
        polymer: "",
        start: 2,
    }, 1);
    legend.append("div")
      .attr("class", "bubble-legend-text")
      .text("Module extents when predicted to be iterative");

    // restrict the height of icon divs to the height of the SVGs, since otherwise
    // they pad out automatically and cause the grid to expand
    $(".bubble-legend-icon").css("height", `${iconHeight}px`);
}

/**
 * Expected entry point from index.js, adds all the relevant handlers
 *
 * @param anchor - the anchor string for the region (e.g. r1c1)
 * @param results - the data for the region
 */
export function drawDomainBubbleData(anchor: string, results: any): void {
    regionCandidates = results;

    // when the candidate dropdown is changed, redraw for the new results
    $(`#${anchor}-domain-bubble-select`).off("change").change(function() {
        const candidate = "" + $(this).val();
        if (!regionCandidates) {
            return;
        }
        if (candidate && regionCandidates[candidate]) {
            const options: ILegendOptions = {};
            actualDrawDomainBubbleData(anchor, regionCandidates[candidate]);
            // since non-elongating modules aren't present for many types, hide them unless one is present
            options.showNonElongating = regionCandidates[candidate].modules.some((module: IModule) => module.nonElongating);
            drawLegend(anchor, options);
        }
    });

    // only when the details tab is first selected, do any drawing
    // otherwise widths will be defaulted and things get ugly
    $(`.body-details-header.${anchor}-nrps-pks-bubbles`).off(".firstClick").one("click.firstClick", () => {
        $(`#${anchor}-domain-bubble-select`).change();
    });

    // initialise a floating tooltip div, if necessary
    if ($(".bubble-tooltip").length === 0) {
        d3select("body")
          .append("div")
          .attr("class", "tooltip bubble-tooltip")
          .text("");
    }
}

/**
 * Goes through all modules, finding and setting the level of a domain to properly
 * step up/down or ziggurat chained modification domains.
 *
 * @param modules - the modules for which to assign levels
 * @returns The highest level found (assuming the baseline is level 1).
 */
function assignLevels(modules: any): number {
    const domains = [];
    for (const module of modules) {
        for (const domain of module.domains) {
            domains.push({dom: domain, mod: domain.modifier});
        }
    }
    // add a dummy domain so as not to leave trailing modifiers unhandled
    domains.push({dom: null, mod: false});
    let index = 0;
    let current = 0;
    let maxLevels = 0;  // additional levels beyond the baseline
    for (const domain of domains) {
        if (domain.dom) {
            domain.dom.level = 0;
        }
        if (domain.mod) {
            current += 1;
            index += 1;
            continue;
        }
        if (current === 0) {
            index += 1;
            continue;
        }
        const middle = Math.floor(current / 2);
        if (middle + current % 2 > maxLevels) {
            maxLevels = middle + current % 2;
        }
        for (let i = 0; i < middle; i++) {
            domains[index - current + i].dom.level = i + 1;
            domains[index - 1 - i].dom.level = i + 1;
        }
        if (current % 2 === 1) {
            domains[index - current + middle].dom.level = middle + 1;
        }
        current = 0;
        index += 1;
    }
    return maxLevels + 1;  // including the baseline
}

/**
 * Adds the SVG elements to the given group that draw the border line around a module
 *
 * @param group - the SVG group element to add the new elements to
 * @param module - the data to base the elements on
 * @param y - the Y coordinate for the top of the module border
 */
function drawModuleLine(group: any, module: IModule, y: number) {
    if (!module.iterative) {
        group.append("line")
          .attr("x1", module.start)
          .attr("x2", module.end)
          .attr("y1", y)
          .attr("y2", y)
          .attr("class", `bubble-module-line${module.nonElongating ? "-non-elongating" : ""}`);
        return group;
    }
    const lower = y + radius * 2.5;
    const midY = y + (lower - y) / 2;
    const arrowX = module.end + 4;
    const arc = lower - midY + 2;
    const left = module.start + radius * 1.5;
    const right = module.end - radius * 1.5;
    // don't put the arrow in the middle, it'll overlap with text
    // also don't put it too close to an edge, due to the curvature
    const arrowTip = module.start + (module.end - module.start) * 0.75;
    group.append("path")
      .attr("class", "bubble-module-line")
      // split the arcs to ensure that the domain edges line up exactly
      // start at the midline on the left, even if it means an extra jump later
      .attr("d", `M ${module.start},${midY}
                  A ${arc} ${arc} 0 0 1 ${left},${y}
                  L ${right},${y}
                  A ${arc} ${arc} 0 0 1 ${module.end},${midY}
                  A ${arc} ${arc} 0 0 1 ${right},${lower}
                  L ${arrowTip},${lower}
                  L ${arrowTip + 10},${lower - 10}
                  M ${arrowTip - 10},${lower}
                  L ${left},${lower}
                  A ${arc} ${arc} 0 0 1 ${module.start},${midY}`)
      .attr("fill", "none");
    return group;
}

/**
 * Adds an SVG element to the specified region with the given data, removing
 * any existing SVG if present.
 *
 * @param anchor - the identifier for the region (e.g. 'r1c1')
 * @param results - the data to draw, generated by antiSMASH
 */
export function actualDrawDomainBubbleData(anchor: string, results: any) {
    // const anchor = window.location.hash.substring(1);
    const container = document.getElementById(`${anchor}-domain-bubble-svg-container`);
    if (!container) {
        return;
    }
    const svgID = `${anchor}-domain-bubble-svg`;
    $(`#${svgID}`).remove();

    if (!results) {
        return;
    }

    const genes: IGene[] = [];
    const modules: IModule[] = results.modules;

    const maxSteps = assignLevels(modules);
    const baseline = radius * (maxSteps + 1) // allow space for domains to ziggurat
                     + arrowHeight * 2;      // and for long gene labels to be above genes

    const svg = d3select(`#${anchor}-domain-bubble-svg-container`).append("svg")
      .attr("width", "100%")
      .attr("height", baseline + radius * 4.5)  // gene labels + domains + module labels
      .attr("id", svgID)
      .attr("class", "domain-bubble-container");

    let currentX = radius;
    // account for initial domains being modification domains
    let currentY = baseline + modifierDY * modules[0].domains[0].level;

    let geneStart = currentX;
    let moduleNumber = 0;
    let completeModule = 0;
    let prevDomain: IModuleDomain | null = null;
    let prevCDS = "";
    let prevDX = 0;
    for (const module of modules) {
        if (moduleNumber > 0) {
            currentX += interModuleGap;
        }
        module.number = ++moduleNumber;
        if (module.complete) {
            module.completeNumber = ++completeModule;
        }
        let domainNumber = 0;
        for (const domain of module.domains) {
            // handle special cases: level changes, overhangs, etc
            if (prevDomain) {  // crosses modules, not just current domainNumber
                if (prevDomain.cds !== domain.cds) {
                    // don't add inter-module and inter-gene gaps
                    if (domainNumber === 0) {
                        currentX -= interModuleGap;
                    }
                    // finalise the previous gene
                    genes.push({
                        end: currentX + prevDomain.radius,
                        name: prevCDS,
                        scale: 1,
                        start: geneStart,
                    });
                    // then add the gap and set the new start position
                    currentX += interGeneGap;
                    geneStart = currentX;
                    // and treat the previous domain as complete
                    prevDX = 0;
                } else if (prevDomain && prevDomain.special && domain.modifier) {
                    // the center of a modification domain following a special domain is smaller
                    prevDX = radius - pythagoras(0, modifierDY, specialRadius + radius);
                } else if (prevDomain.level !== domain.level) {
                    // when stepping up/down, the distance is again smaller
                    prevDX = modifierDX;
                } else {
                    prevDX = prevDomain.radius;
                }

                // while terminal docking domains aren't in modules, they don't need the module gap
                if (prevDomain.cds === domain.cds && (domain.terminalDocking || prevDomain.terminalDocking)) {
                    prevDX -= interModuleGap;
                }
            }

            // add the latter half of the previous domain
            currentX += prevDX;

            if (domain.special) {
                domain.radius = specialRadius;
            } else {
                domain.radius = radius;
            }
            // set the center of the current domain
            currentX += domain.radius;
            domain.x = currentX;

            if (prevDomain && prevDomain.level !== domain.level) {
                if (prevDomain.level > domain.level) {
                    currentY -= modifierDY;
                } else {
                    currentY += modifierDY;
                }
            }
            // always reset to the baseline if a terminal docking domain is found
            if (domain.terminalDocking) {
                currentY = baseline;
            }
            domain.y = currentY;

            prevDomain = domain;
            prevCDS = domain.cds;

            domainNumber += 1;
        }
        const first = module.domains[0];
        const last = module.domains[module.domains.length - 1];
        module.start = first.x - first.radius;
        module.end = last.x + last.radius;

        prevDX = 0;
    }
    // move across to complete the very last domain
    if (prevDomain) {
        currentX += prevDomain.radius;
    }
    genes.push({
        end: currentX,
        name: prevCDS,
        scale: 1,
        start: geneStart,
    });

    const tooltip = d3select(".bubble-tooltip");

    moduleNumber = 0;

    function drawDomain(this: any, domain: any) {
        const group = d3select(this);
        if (domain.terminalDocking) {
            drawTerminalDocking(group, domain);
            return;
        }
        group.append("circle")
          .attr("class", (d: any) => `${d.css}`)
          .attr("cx", (d: any) => d.x)
          .attr("cy", (d: any) => d.y)
          .attr("r", (d: any) => d.special ? specialRadius : radius);

        group.append("text")
          .attr("x", (d: any) => d.x)
          .attr("y", (d: any) => d.y + radius / 3)
          .attr("text-anchor", "middle")
          .text((d: any) => d.special ? "" : d.name);

        // the distance in pure X or Y axes to the tips of a cross centered on the domain
        const crossManhattan = Math.sqrt((radius * radius) / 2);
        const inactives = group.filter((d: any) => d.inactive)
          .append("g")
            .attr("class", "bubble-domain-inactive");
        inactives.append("line")
          .attr("x1", (d: any) => d.x - crossManhattan)
          .attr("x2", (d: any) => d.x + crossManhattan)
          .attr("y1", (d: any) => d.y - crossManhattan)
          .attr("y2", (d: any) => d.y + crossManhattan);
        inactives.append("line")
          .attr("x1", (d: any) => d.x - crossManhattan)
          .attr("x2", (d: any) => d.x + crossManhattan)
          .attr("y1", (d: any) => d.y + crossManhattan)
          .attr("y2", (d: any) => d.y - crossManhattan);
    }

    for (const module of modules) {
        const svgModule = svg.append("g").attr("class", `module-group-${module.number}`)
          .selectAll(`g.domain-group`).data(module.domains).enter()
            .append("g").attr("class", "g.domain-group");
        svgModule.each(drawDomain);

        if (!module.complete) {
            svgModule.style("opacity", "50%");
        }
        // show full domain names on mouseover
        svgModule.on("click", (d: any) =>
           tooltip.text(d.description)
             .style("display", "block")
             .style("top", `${d3event.pageY + 20}px`)
             .style("left", `${d3event.pageX + 20}px`))
         .on("mouseout", () => tooltip.style("display", "none"));
    }

    // don't let a trailing modifier leave following elements too high
    currentY = baseline;

    const outerLabels = svg.append("g").attr("class", "module-labels");
    const moduleLabels: d3.Selection<any, IModule, any, any> = outerLabels.selectAll("g.bubble-module-label")
        .data(modules.filter((d) => d.complete)).enter()
        .append("g").attr("class", "bubble-module-label");
    moduleLabels.each(function(this: any, d: IModule) {
        return drawModuleLine(d3select(this), d, currentY + radius * 1.5);
    }).append("text")
      .attr("x", (d: IModule) => (d.start + d.end) / 2)
      .attr("y", currentY + 2.5 * radius)
      .attr("class", "bubble-module-number")
      .attr("text-anchor", "middle")
      .text((d: IModule) => `M ${d.completeNumber}`);
    moduleLabels.append("text")
      .attr("x", (d: IModule) => (d.start + d.end) / 2)
      .attr("y", currentY + 3.5 * radius)
      .attr("class", "bubble-module-monomer")
      .attr("text-anchor", "middle")
      .text((d: IModule) => d.polymer);

    // move up to draw the gene arrows/labels above the modules themselves
    currentY -= radius * (maxSteps + 1);

    const geneLabels = svg.append("g").attr("class", "bubble-genes")
      .selectAll("line.bubble-gene-line").data(genes).enter().append("g");
    geneLabels
      .attr("data-locus", (d: IGene) => d.name)
      .attr("class", "bubble-gene");
    geneLabels.append("polygon")
      .attr("class", "bubble-gene-arrow")
      .attr("points", (d: IGene) => geneArrow(d.start, d.end, currentY));

    geneLabels.append("text")
      .text((d: IGene) => d.name)
      // an initial (approximate) position is required for finding correct font size
      // but will be updated later
      .attr("x", (d: IGene) => (d.start + d.end) / 2)
      .attr("y", currentY)
      .attr("class", "serif bubble-gene-label")
      // find and set the correct font-size to fit the text in the arrow
      .style("font-size", "1px")
      .each(setTextScale)
      .style("font-size", (d: IGene) => d.scale >= minFontSize ? `${d.scale}px` : `${minFontSize}px`)
      .style("fill", (d: IGene) => d.scale >= minFontSize ? "white" : "black")
      // adjust horizontal position when it would otherwise go out of bounds
      // but set the anchor position to make calculations easier
      .attr("text-anchor", (d: IGene, i: number) => {
        if (d.scale < minFontSize) {
            if (i === 0) {
                return "start";
            } else if (i === genes.length - 1) {
                return "end";
            }
        }
        return "middle";
      })
      .attr("x", (d: IGene, i: number) => {
        const position = Math.floor((d.start + d.end) / 2);
        if (d.scale < minFontSize) {
            if (i === 0) {
                return d.start;
            } else if (i === genes.length - 1) {
                return d.end;
            }
            return position;
        }
        // adjust slightly because the text look too far to the right when centered including the arrowhead
        return position - arrowHeadWidth / 5;
      })
      // then adjust position to vertically center the newly sized text
      .attr("y", (d: IGene, i: number) => {
        // if it's too small to be readable, it'll go above the arrow itself
        if (d.scale < minFontSize) {
            return currentY - arrowHeight * 1.5
                   + (1.5 * minFontSize) * ((i + 1) % 2);  // alternate so no two long labels overlap
        }
        return Math.floor(currentY + d.scale / 3);
      });

    // now that the full width of the SVG is known, set the element width (with some padding)
    svg.attr("width", currentX + 2 * radius);

    // label as overview selector as per viewer.js
    $(".bubble-gene").off("click").click(function(this: HTMLElement, event: JQuery.Event<HTMLElement, null>) {
        $(`#${locusToFullId($(this).attr("data-locus") || "none")}-svgeneorf`).trigger(event);
    });
}

/**
 * Determines text scaling such that the gene label fits into the parent arrow.
 * Requires that the text itself is initially set to a font size of 1px.
 * Assumes that the width is the only dimension of arrows that varies.
 *
 * @param gene - the gene data, with any included modules
 */
function setTextScale(this: any, gene: IGene) {
    if (!this || !this.parentNode) {
        gene.scale = geneFontSize;
        return;
    }
    const text = this.getBBox();
    const parent = this.parentNode.getBBox();
    const parentHeight = parent.height - 4; // ensures a couple of pixels above and below
    gene.scale = Math.min(geneFontSize, Math.round((parent.width - arrowHeadWidth) / text.width));
    return gene.scale;
}

/**
 * Generates the SVG path string for a gene.
 * Head/tip width will be proportional if lower than the default size.
 *
 * @param start - the X coordinate for the start/left side of the arrow
 * @param end - the X coordinate for the end/right side of the arrow
 * @param verticalMidline - the Y coordinate for the tip of the arrow
 * @returns A string describing the path of the gene.
 */
function geneArrow(start: number, end: number, verticalMidline: number): string {
    const top = verticalMidline - arrowHeight / 2;
    const bottom = top + arrowHeight;
    let headWidth = arrowHeadWidth;
    if ((end - start) * 0.2 < headWidth) {
        headWidth = Math.floor((end - start) * 0.2);
    }
    const headHeight = Math.floor((bottom - top) / 5);
    const headStart = end - headWidth;
    return `${start},${top}
            ${headStart},${top}
            ${headStart},${top - headHeight}
            ${end},${verticalMidline}
            ${headStart},${bottom + headHeight}
            ${headStart},${bottom}
            ${start},${bottom}
            ${start},${top}`;
}
