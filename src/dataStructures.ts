/* License: GNU Affero General Public License v3 or later
   A copy of GNU AGPL v3 should have been included in this software package in LICENSE.txt. */

export interface IDomain {  // maps to antismash.common.json.JSONDomain
    readonly type: string;
    readonly start: number;
    readonly end: number;
    readonly predictions: string[];
    readonly napdoslink: string;
    readonly blastlink: string;
    readonly sequence: string;
    readonly dna_sequence: string;
    readonly abbreviation: string;
    readonly html_class: string;
}

export interface IOrf {
    readonly start: number;
    readonly end: number;
    readonly strand: number;
    readonly type: string;
    readonly description: string;
    readonly locus_tag: string;
    readonly resistance?: boolean;
    readonly color?: string;
}

export interface IModule {
    readonly start: number;
    readonly end: number;
    readonly complete: boolean;
}

export interface IDomainsOrf {
    readonly sequence: string;
    readonly id: string;
    readonly domains: IDomain[];
    readonly modules: IModule[];
}

export interface ICluster {
    readonly start: number;
    readonly end: number;
    readonly neighbouring_start: number;
    readonly neighbouring_end: number;
    readonly product: string;
    readonly height: number;
    readonly tool: string;
    readonly isCandidateCluster: boolean;
}

export interface ITTACodon {
    readonly start: number;
    readonly end: number;
    readonly strand: number;
    readonly containedBy: string[];
}

export interface IRegion {
    readonly anchor: string;
    readonly start: number;
    readonly end: number;
    readonly idx: number;
    readonly ttaCodons: ITTACodon[];
    readonly clusters: ICluster[];
    readonly orfs: IOrf[];
    readonly label: string;
    readonly products: string[];
}

export interface IDomainsRegion {
    readonly id: string;
    readonly orfs: IDomainsOrf[];
}

export interface IRecord {
    readonly length: number;
    readonly seq_id: string;
    readonly regions: IRegion[];
}
