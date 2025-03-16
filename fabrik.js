import { tiny, defs } from './examples/common.js';

const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

/** 
 * EndEffector represents a joint in the IK chain.
 * Each segment stores its current position and the desired length to the next segment.
 */
export class EndEffector {
  constructor(position, length) {
    // Copy the provided position into a new vec3.
    this.position = vec3(position[0], position[1], position[2]);
    this.length = length;
    // this.model = model;
    // this.material = material;  maybe make it so it can be custom shapes?
  }
}

/**
 * Fabrik implements the FABRIK (Forward And Backward Reaching Inverse Kinematics) algorithm.
 * It maintains a chain of EndEffectors that are adjusted to reach a target.
 */
export class Fabrik {
  /**
   * Constructs a FABRIK chain.
   * @param {vec3} root - The starting (root) position of the chain.
   * @param {number} numSegments - Number of segments in the chain.
   * @param {number} defaultLength - The length of each segment.
   */
  constructor(root, numSegments, defaultLength = 10) {
    // Store the root position.
    this.root = vec3(root[0], root[1], root[2]); // Root for the dragon is the tail.
    this.segments = [];
    this.numSegments = numSegments;
    this.t = 0;

    // Initialize segments in a straight line from the root along the x-axis.
    let currentPos = this.root.copy();
    for (let i = 0; i < numSegments; i++) {
      let seg = new EndEffector(currentPos, defaultLength);
      this.segments.push(seg);
      // Advance currentPos along x (or any other desired direction).
      currentPos = currentPos.plus(vec3(defaultLength, 0, 0));
    }

    // Set the initial target to the position of the last segment.
    this.target = this.segments[this.segments.length - 1].position.copy();
  }

  /**
   * Sets a new target for the IK chain.
   * @param {vec3} newTarget - The new target position.
   */
  setTarget(newTarget) {
    this.target = vec3(newTarget[0], newTarget[1], newTarget[2]);
  }

  /**
   * Forward reaching phase:
   * Moves the end effector to the target and works backward to adjust the positions.
   */
  fabrikForward() {
    let n = this.segments.length;
    // Set the end effector to the target.
    this.segments[n - 1].position = this.target.copy();
    // Iterate backwards through the chain.
    for (let i = n - 2; i >= 0; i--) {
      let current = this.segments[i];
      let next = this.segments[i + 1];
      // Compute the direction from current to next, normalized and scaled to the segment's length.
      let direction = next.position.minus(current.position).normalized().times(current.length);
      // Update the current segment's position so that it is at the correct distance from next.
      current.position = next.position.minus(direction);

      // add wiggle??
      // const t = this.t;
      // const wiggle = vec3(0, 
      //                     0.3 * (Math.PI / 180) * Math.sin(t / 10), 
      //                     0);
      // current.position = current.position.plus(wiggle);
    
    }
  }

  /**
   * Backward reaching phase:
   * Sets the root to its original position and works forward, reestablishing the segment lengths.
   */
  fabrikBackward() {
    // Set the root's position.
    this.segments[0].position = this.root.copy();
    let n = this.segments.length;
    for (let i = 1; i < n; i++) {
      let previous = this.segments[i - 1];
      let current = this.segments[i];
      // Compute the direction from the previous segment to the current one.
      let direction = current.position.minus(previous.position).normalized().times(previous.length);
      // Position the current segment at the correct distance from the previous.
      current.position = previous.position.plus(direction);
    }
  }

  /**
   * Runs the FABRIK algorithm for a given number of iterations.
   * More iterations yield smoother, more accurate convergence.
   * @param {number} iterations - Number of forward/backward passes to perform.
   */
  update(iterations = 1) {
    for (let i = 0; i < iterations; i++) {
      this.fabrikForward();
    //   this.fabrikBackward();
    }
  }

  /**
   * Displays the IK chain.
   * Draws a small sphere at each joint and a cylinder connecting each adjacent pair.
   * @param {object} caller - The rendering context.
   * @param {object} uniforms - Uniforms for the shader.
   * @param {object} shapes - Contains shape objects (e.g., sphere and cylinder).
   * @param {object} materials - Contains material definitions.
   */
  display(caller, uniforms, shapes, materials) {
    const blue = color( 0,0,1,1 ), white = color( 1,1,1,1 );

    // Draw spheres at each segment's position.
    // for (let seg of this.segments) {
    //   let pos = seg.position;
    //   let model_transform = Mat4.translation(pos[0], pos[1], pos[2])
    //                         .times(Mat4.scale(0.2, 0.2, 0.2));
    //   shapes.ball.draw(caller, uniforms, model_transform, { ...materials.metal, color: white });    
    // }

    // Draw cylinders (lines) connecting adjacent segments.
    for (let i = 0; i < this.segments.length - 1; i++) {
      let p1 = this.segments[i].position;
      let p2 = this.segments[i + 1].position;

      this.t = uniforms.animation_time/1000;

      // Convert positions to vec3 if necessary.
      let pos1 = vec3(p1[0], p1[1], p1[2]);
      let pos2 = vec3(p2[0], p2[1], p2[2]);

      const len = pos2.minus(pos1).norm();
      const center = pos1.plus(pos2).times(0.5);

      // Start with a default model transform.
      let model_transform; 

      // if (i == this.segments.length - 3 ){
      //   model_transform = Mat4.scale(-0.7, -len / 2, -0.7);
      // } else if (i == this.segments.length - 4 ){
      //   model_transform = Mat4.scale(-0.8, -len / 2, -0.8);
      // } else if (i == this.segments.length - 5 ){
      //   model_transform = Mat4.scale(-0.9, -len / 2, -0.9);
      // } else {
      //   model_transform = Mat4.scale(-1, -len / 2, -1);
      // }
      if (i == this.segments.length - 3 ){
        model_transform = Mat4.scale(-0.7, -0.7, -len / 2);
      } else if (i == this.segments.length - 4 ){
        model_transform = Mat4.scale(-0.8, -0.8, -len / 2);
      } else if (i == this.segments.length - 5 ){
        model_transform = Mat4.scale(-0.9, -0.9, -len / 2);
      } else if (i == 1 ){
        model_transform = Mat4.scale(-0.7, -0.7, -len / 2);
      } else {
        model_transform = Mat4.scale(-1, -1, -len / 2);
      }
      
      // Compute the direction vector from pos1 to pos2.
      // const p = pos1.minus(pos2).normalized();
      // let v = vec3(0, 1, 0);
      // if (Math.abs(v.cross(p).norm()) < 0.1) {
      //   v = vec3(0, 0, 1);
      //   model_transform = Mat4.scale(0.05, 0.05, len / 2);
      // }
      // const w = v.cross(p).normalized();
      // const theta = Math.acos(v.dot(p));

      // model_transform.pre_multiply(Mat4.rotation(theta, w[0], w[1], w[2]));
      // model_transform.pre_multiply(Mat4.translation(center[0], center[1], center[2]));



      const upVector = vec3(0, 1, 0);
      const forward = pos2.minus(pos1).normalized(); // Direction from p1 to p2
      const right = upVector.cross(forward).normalized(); // Right vector
      const up = forward.cross(right).normalized(); // Re-calculate up to ensure orthogonality

      // Construct rotation matrix
      let rotationMatrix = Mat4.identity();
      // console.log(rotationMatrix);
      rotationMatrix[0][0] = right[0];
      rotationMatrix[1][0] = right[1];
      rotationMatrix[2][0] = right[2];

      rotationMatrix[0][1] = up[0];
      rotationMatrix[1][1] = up[1];
      rotationMatrix[2][1] = up[2];

      rotationMatrix[0][2] = forward[0];
      rotationMatrix[1][2] = forward[1];
      rotationMatrix[2][2] = forward[2];

      model_transform.pre_multiply(rotationMatrix);
      model_transform.pre_multiply(Mat4.translation(center[0], center[1], center[2]));

      if (i == this.segments.length - 2 ){
        shapes.head.draw(caller, uniforms, model_transform, materials.dragon);

      } else if (i == 0 ){
        shapes.tail.draw(caller, uniforms, model_transform, materials.dragon);
      } else if (i == this.segments.length - 4){
        // shapes.leg.draw(caller, uniforms, model_transform, materials.drsdagon);
        shapes.body.draw(caller, uniforms, model_transform, materials.dragon);


      } else {
        shapes.body.draw(caller, uniforms, model_transform, materials.dragon);
      }
    }
  }
}
