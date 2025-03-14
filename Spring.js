import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

export class Spring {
    constructor(p_i, p_j, ks, kd, l){
        this.p_i = p_i;
        this.p_j = p_j;
        this.ks = ks;
        this.kd = kd;
        this.l = l;
    }

    set_p_i(p_i){
        this.p_i = p_i;
    }

    set_p_j(p_j){
        this.p_j = p_j;
    }

    set_p_j(ks){
        this.ks = ks;
    }
    
    set_p_j(kd){
        this.kd = kd;
    }

    set_p_j(l){
        this.l = l;
    }

    set_curve(fn, num_samples) {
        this.curve = new Curve_Shape(fn, num_samples);
    }
}