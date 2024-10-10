/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

import {ICluster} from "./pythonStructures.js";
import {Transform} from "./transform.js";

export class Area implements ICluster {
    public static fromInterface(existing: ICluster) {
        const res = new Area(
            existing.start,
            existing.end,
            existing.height,
            existing.neighbouring_start ?? existing.start,
            existing.neighbouring_end ?? existing.end,
            existing.product ?? "",
            existing.category ?? "",
            existing.tool ?? "",
            existing.kind ?? "",
            existing.prefix ?? "",
            existing.group,
        );
        return res;
    }

    public readonly start: number;
    public readonly end: number;
    public readonly neighbouringStart: number;
    public readonly neighbouringEnd: number;
    public readonly product: string;
    public readonly category: string;
    public readonly height: number;
    public readonly tool: string;
    public readonly kind: string;
    public readonly prefix: string;
    public readonly group?: number;
    public readonly css: string;
    public otherSide?: Area;
    public transform: Transform;

    constructor(start: number, end: number, height: number,
                neighbouringStart: number, neighbouringEnd: number,
                product: string, category: string, tool: string, kind: string, prefix: string,
                group?: number, otherSide?: Area) {
        this.start = start;
        this.end = end;
        this.height = height;
        this.neighbouringStart = neighbouringStart ?? start;
        this.neighbouringEnd = neighbouringEnd ?? end;
        this.product = product ?? "";
        this.category = category ?? "";
        this.tool = tool ?? "";
        this.prefix = prefix ?? "";
        this.kind = kind ?? "";
        this.group = group;
        this.otherSide = otherSide;
        this.css = this.kind === "candidatecluster"
            ? `candidate-${product.split(" ")[2].replace("chemical_", "")}` // e.g. "candidate-hybrid"
            : (this.kind === "subregion" && this.prefix.length === 0 // it isn't a sideloaded subregion
                ? `svgene-border-${this.tool}`
                : ""
              );
        this.transform = new Transform(0, 0, 0, 0);
    }

    public isSplit() {
        return this.otherSide !== undefined;
    }

    public containsCore() {
        return this.start !== this.end;
    }

    public splitsInNeighbourhood() {
        if (!this.isSplit() || this.kind !== "protocluster") {
            return false;
        }
        return this.otherSide !== undefined && !(this.otherSide.containsCore() && this.containsCore());
    }

    public getWidthOffset() {
        if (this.splitsInNeighbourhood() && this.neighbouringStart === 0) {
            return 1;
        }
        return 0;
    }
}
