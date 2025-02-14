import {tiny, defs} from './examples/common.js';

// Pull these names into this module's scope for convenience:
const { vec3, vec4, color, Mat4, Shape, Material, Shader, Texture, Component } = tiny;

// TODO: you should implement the required classes here or in another file.
export class Curve_Shape extends Shape {
  // curve_function: (t) => vec3
  constructor(curve_function, sample_count, curve_color=color( 1, 0, 0, 1 )) {
    super("position", "normal");

    this.material = { shader: new defs.Phong_Shader(), ambient: 1.0, color: curve_color }
    this.sample_count = sample_count;

    if (curve_function && this.sample_count) {
      for (let i = 0; i < this.sample_count + 1; i++) {
        let t = i / this.sample_count;
        this.arrays.position.push(curve_function(t));
        this.arrays.normal.push(vec3(0, 0, 0)); // have to add normal to make Phong shader work.
      }
    }
  }

  draw(webgl_manager, uniforms) {
    // call super with "LINE_STRIP" mode
    super.draw(webgl_manager, uniforms, Mat4.identity(), this.material, "LINE_STRIP");
  }

  update(webgl_manager, uniforms, curve_function) {
    if (curve_function && this.sample_count) {
      for (let i = 0; i < this.sample_count + 1; i++) {
        let t = 1.0 * i / this.sample_count;
        this.arrays.position[i] = curve_function(t);
      }
    }
    // this.arrays.position.forEach((v, i) => v = curve_function(i / this.sample_count));
    this.copy_onto_graphics_card(webgl_manager.context);
    // Note: vertex count is not changed.
    // not tested if possible to change the vertex count.
  }
};


export
const Part_one_hermite_base = defs.Part_one_hermite_base =
    class Part_one_hermite_base extends Component
    {                                          // **My_Demo_Base** is a Scene that can be added to any display canvas.
                                               // This particular scene is broken up into two pieces for easier understanding.
                                               // The piece here is the base class, which sets up the machinery to draw a simple
                                               // scene demonstrating a few concepts.  A subclass of it, Part_one_hermite,
                                               // exposes only the display() method, which actually places and draws the shapes,
                                               // isolating that code so it can be experimented with on its own.
      init()
      {
        console.log("init")

        // constructor(): Scenes begin by populating initial values like the Shapes and Materials they'll need.
        this.hover = this.swarm = false;
        // At the beginning of our program, load one of each of these shape
        // definitions onto the GPU.  NOTE:  Only do this ONCE per shape it
        // would be redundant to tell it again.  You should just re-use the
        // one called "box" more than once in display() to draw multiple cubes.
        // Don't define more than one blueprint for the same thing here.
        this.shapes = { 'box'  : new defs.Cube(),
          'ball' : new defs.Subdivision_Sphere( 4 ),
          'axis' : new defs.Axis_Arrows(), 
          'square' : new defs.Square() };



        // *** Materials: ***  A "material" used on individual shapes specifies all fields
        // that a Shader queries to light/color it properly.  Here we use a Phong shader.
        // We can now tweak the scalar coefficients from the Phong lighting formulas.
        // Expected values can be found listed in Phong_Shader::update_GPU().
        const phong = new defs.Phong_Shader();
        const tex_phong = new defs.Textured_Phong();
        this.materials = {};
        this.materials.plastic = { shader: phong, ambient: .2, diffusivity: 1, specularity: .5, color: color( .9,.5,.9,1 ) }
        this.materials.metal   = { shader: phong, ambient: .2, diffusivity: 1, specularity:  1, color: color( .9,.5,.9,1 ) }
        this.materials.rgb = { shader: tex_phong, ambient: .5, texture: new Texture( "assets/rgb.jpg" ) }

        this.ball_location = vec3(1, 1, 1);
        this.ball_radius = 0.25;

        // TODO: you should create a Spline class instance
        // const controlPoints = [{ x: 0, y: 1, z: 2 }, { x: 5, y: 5, z: 5 }];
        const controlPoints = [];
        // const tangents = [{ sx: 1, sy: 0, sz: 0 }, { sx: 0, sy: 1, sz: 0 }];
        const tangents = [];
        this.spline = new Hermit_spline(controlPoints, tangents);
        // this.sample_cnt = 1000;
        this.curve_fn = (t) => this.spline.computePoint(t)
        this.sample_cnt = 1000;
        this.curve = new Curve_Shape(this.curve_fn, this.sample_cnt);

        // Compute the point at t = 0.5
        const point = this.spline.computePoint(0.5);
        console.log(point); // { x: 0.5, y: 0.5, z: 0.5 }
      }

      render_animation( caller )
      {                                                // display():  Called once per frame of animation.  We'll isolate out
        // the code that actually draws things into Part_one_hermite, a
        // subclass of this Scene.  Here, the base class's display only does
        // some initial setup.

        // Setup -- This part sets up the scene's overall camera matrix, projection matrix, and lights:
        if( !caller.controls )
        { this.animated_children.push( caller.controls = new defs.Movement_Controls( { uniforms: this.uniforms } ) );
          caller.controls.add_mouse_controls( caller.canvas );

          // Define the global camera and projection matrices, which are stored in shared_uniforms.  The camera
          // matrix follows the usual format for transforms, but with opposite values (cameras exist as
          // inverted matrices).  The projection matrix follows an unusual format and determines how depth is
          // treated when projecting 3D points onto a plane.  The Mat4 functions perspective() or
          // orthographic() automatically generate valid matrices for one.  The input arguments of
          // perspective() are field of view, aspect ratio, and distances to the near plane and far plane.

          // !!! Camera changed here
          Shader.assign_camera( Mat4.look_at (vec3 (10, 10, 10), vec3 (0, 0, 0), vec3 (0, 1, 0)), this.uniforms );
        }
        this.uniforms.projection_transform = Mat4.perspective( Math.PI/4, caller.width/caller.height, 1, 100 );

        // *** Lights: *** Values of vector or point lights.  They'll be consulted by
        // the shader when coloring shapes.  See Light's class definition for inputs.
        const t = this.t = this.uniforms.animation_time/1000;
        const angle = Math.sin( t );

        // const light_position = Mat4.rotation( angle,   1,0,0 ).times( vec4( 0,-1,1,0 ) ); !!!
        // !!! Light changed here
        const light_position = vec4(20 * Math.cos(angle), 20,  20 * Math.sin(angle), 1.0);
        this.uniforms.lights = [ defs.Phong_Shader.light_source( light_position, color( 1,1,1,1 ), 1000000 ) ];

        // draw axis arrows.
        this.shapes.axis.draw(caller, this.uniforms, Mat4.identity(), this.materials.rgb);
      }
    }


export class Hermit_spline {
  constructor(controlPoints, tangents) {
    // this.controlPoints = []; 
    this.controlPoints = controlPoints; // Array to store control points: [{ x, y, z }]
    // this.tangents = [];     
    this.tangents = tangents;      // Array to store tangents: [{ sx, sy, sz }]

    this.arcLengthTable = [];
    this.numSamples = 1000;
  }




  // Compute the point on the spline at parameter t (0 <= t <= 1)
  computeSubPoint(t, pid) {
    if (this.controlPoints.length < 2 || this.tangents.length < 2) {
      console.log("Spline requires 2 control points and 2 tangents.");
    }

    const pid2 = pid + 1;

    const P0 = this.controlPoints[pid];
    const P1 = this.controlPoints[pid2];
    const T0 = this.tangents[pid];
    const T1 = this.tangents[pid2];

    // Tangent Scaling
    const segmentLength = Math.sqrt(
      Math.pow(P1.x - P0.x, 2) +
      Math.pow(P1.y - P0.y, 2) +
      Math.pow(P1.z - P0.z, 2)
    );
    
    const T0_scaled = { sx: T0.sx / segmentLength, sy: T0.sy / segmentLength, sz: T0.sz / segmentLength };
    // const T0_scaled = T0;
    const T1_scaled = { sx: T1.sx / segmentLength, sy: T1.sy / segmentLength, sz: T1.sz / segmentLength };
    // const T1_scaled = T1;
    

    const P = [
      [P0.x, P0.y, P0.z],
      [P1.x, P1.y, P1.z],
      [T0_scaled.sx, T0_scaled.sy, T0_scaled.sz],
      [T1_scaled.sx, T1_scaled.sy, T1_scaled.sz]
    ];

      // Geometry Matrix (G)
    const G = [
      [P0.x, P0.y, P0.z],
      [P1.x, P1.y, P1.z],
      [T0_scaled.sx, T0_scaled.sy, T0_scaled.sz],
      [T1_scaled.sx, T1_scaled.sy, T1_scaled.sz]
    ];

    // const MH = [
    //   [1, 0 ,0, 0],
    //   [0, 1, 0, 0],
    //   [-3, -2, 3, -1],
    //   [2, 1, -2, 1]
    // ];

    const MH = [
      [2, -2, 1, 1],
      [-3, 3, -2, -1],
      [0, 0, 1, 0],
      [1, 0, 0, 0]
    ];

    const result = [0, 0, 0]; 


    const T = [t ** 3, t ** 2, t, 1];

    // using the matrix method?
    // for (let i = 0; i < 3; i++) { // Iterate over x, y, z components
    //   let temp = [0, 0, 0, 0];
    //   for (let j = 0; j < 4; j++) {
    //     temp[j] = MH[j][0] * G[0][i] +
    //               MH[j][1] * G[1][i] +
    //               MH[j][2] * G[2][i] +
    //               MH[j][3] * G[3][i];
    //   }
  
    //   result[i] = T[0] * temp[0] + T[1] * temp[1] + T[2] * temp[2] + T[3] * temp[3];
    // }
    // return vec3(result[0], result[1], result[2]);


//p_{0}\cdot(2\cdot t^{3}-3\cdot t^{2}+1)+v_{1}\cdot(t^{3}-t^{2})+v_{0}\cdot(t^{3}-2\cdot t^{2}+t)+p_{1}\cdot(3\cdot t^{2}-2\cdot t^{3})
    // using the equation method?
    for (let i = 0; i < 3; i++) {
      result[i] =
        P[0][i] * (2 * T[0] - 3 * T[1] + 1) +
        P[3][i] * (T[0] - T[1]) +
        P[2][i] * (T[0] - 2 * T[1] + t) +
        P[1][i] * (3 * T[1] - 2 * T[0]);
    }
    return vec3(result[0], result[1], result[2]);
  }

  computePoint(t) {
    // T must be number from 0 to 1
    if (t < 0 || t > 1) {
      console.log("t must be a number from 0 to 1");
      return vec3(0,0,0);
      return null;
    }
    if (this.controlPoints.length < 2 || this.tangents.length < 2) {
      // console.log("Spline requires 2 control points and 2 tangents.");
      return vec3(0,0,0);
      return null;
    }
    
    // Determine which section the t value corresponds to
    const numSections = this.controlPoints.length - 1;  // Number of segments
    const sectionLength = 1 / numSections;  // Length of each section in parameter space

    // Determine the segment index (pid)
    const pid = Math.min(Math.floor(t / sectionLength), numSections - 1);
    const localT = (t - pid * sectionLength) / sectionLength; // Map t to the [0, 1] range for that segment
    // console.log("t is " + t + ", num sections is " + numSections + ", section length is " + sectionLength + ", pid is " + pid + ", localT is " + localT);
    // Compute the point on the segment
    return this.computeSubPoint(localT, pid);
  }

  getPoints(){
    return this.controlPoints;
  }

  getTangents(){
    return this.tangents;
  }

  addPoint(position, tangent) {
    this.controlPoints.push(position); // position is { x, y, z }
    this.tangents.push(tangent);       // tangent is { sx, sy, sz }
  }

  // Set the tangent at a specific index
  setTangent(index, tangent) {
    if (index >= 0 && index < this.tangents.length) {
      this.tangents[index] = tangent;
    } else {
      throw new Error("Invalid index for tangent.");
    }
  }

  // Set the control point at a specific index
  setPoint(index, position) {
    if (index >= 0 && index < this.controlPoints.length) {
      this.controlPoints[index] = position;
    } else {
      throw new Error("Invalid index for control point.");
    }
  }


  buildArcLengthTable(){
    this.arcLengthTable[0] = 0;
    let prevPoint = this.computePoint(0); // Start point

    for (let i = 1; i <= this.numSamples; i++) {
      const t = i / this.numSamples;
      const currPoint = this.computePoint(t);
      console.log("currPoint point is " + currPoint + ", t: " + t);

      const dist = Math.sqrt(
        Math.pow(currPoint[0] - prevPoint[0], 2) +
        Math.pow(currPoint[1] - prevPoint[1], 2) +
        Math.pow(currPoint[2] - prevPoint[2], 2)
      );
      prevPoint = currPoint;

      this.arcLengthTable[i] = this.arcLengthTable[i - 1] + dist;
    }
  }

  // compute arc length
  /*
  Arc length parameterization using a piecewise linear approximation and a look-up table. The
following shell command should print the arc length of a spline. (print to outpu */
  computeArcLength(){   
    if (this.controlPoints.length < 2 || this.tangents.length < 2) {
      console.log("Spline requires 2 control points and 2 tangents.");
      return 0;
    }
    this.buildArcLengthTable();

    return this.arcLengthTable.at(-1);
  }

  // Export the spline 
  export() {
    let output = `${this.controlPoints.length}\n`;
    this.controlPoints.forEach((point, index) => {
      const tangent = this.tangents[index];
      output += `${point.x} ${point.y} ${point.z}`;
      output += ` ${tangent.sx} ${tangent.sy} ${tangent.sz}\n`;
    });
    return output.trim();
  }
  
  // Load a spline 
  load(input) {
    const lines = input.split("\n");
    const numPoints = parseInt(lines[0], 10);
  
    this.controlPoints = [];
    this.tangents = [];
  
    for (let i = 1; i < lines.length; i ++) {
      const match = lines[i].match(/^([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)\s+([\d.\-]+)$/);
  
      if (match) {
        const [_, cx, cy, cz, sx, sy, sz] = match;
        this.controlPoints.push({ x: parseFloat(cx), y: parseFloat(cy), z: parseFloat(cz) });
        this.tangents.push({ sx: parseFloat(sx), sy: parseFloat(sy), sz: parseFloat(sz) });
      } else {
        throw new Error(`Bad input at line ${i + 1}. Expected 6  values.`);
      }
    }
  
    if (this.controlPoints.length !== numPoints) {
      throw new Error("bad input: Mismatch in number of control points.");
    }
  }
  /*
20
0 0 0 1 0 0
1 1 0 0 1 0
2 2 0 -1 0 0
3 3 0 0 -1 0
4 4 0 1 0 0
5 5 0 0 1 0
6 6 0 -1 0 0
7 7 0 0 -1 0
8 8 0 1 0 0
9 9 0 0 1 0
10 10 0 -1 0 0
11 11 0 0 -1 0
12 12 0 1 0 0
13 13 0 0 1 0
14 14 0 -1 0 0
15 15 0 0 -1 0
16 16 0 1 0 0
17 17 0 0 1 0
18 18 0 -1 0 0
19 19 0 0 -1 0
*/
}

export class Part_one_hermite extends Part_one_hermite_base
{                                                    // **Part_one_hermite** is a Scene object that can be added to any display canvas.
                                                     // This particular scene is broken up into two pieces for easier understanding.
                                                     // See the other piece, My_Demo_Base, if you need to see the setup code.
                                                     // The piece here exposes only the display() method, which actually places and draws
                                                     // the shapes.  We isolate that code so it can be experimented with on its own.
                                                     // This gives you a very small code sandbox for editing a simple scene, and for
                                                     // experimenting with matrix transformations.
  render_animation( caller )
  {                                                // display():  Called once per frame of animation.  For each shape that you want to
    // appear onscreen, place a .draw() call for it inside.  Each time, pass in a
    // different matrix value to control where the shape appears.

    // Variables that are in scope for you to use:
    // this.shapes.box:   A vertex array object defining a 2x2x2 cube.
    // this.shapes.ball:  A vertex array object defining a 2x2x2 spherical surface.
    // this.materials.metal:    Selects a shader and draws with a shiny surface.
    // this.materials.plastic:  Selects a shader and draws a more matte surface.
    // this.lights:  A pre-made collection of Light objects.
    // this.hover:  A boolean variable that changes when the user presses a button.
    // shared_uniforms:  Information the shader needs for drawing.  Pass to draw().
    // caller:  Wraps the WebGL rendering context shown onscreen.  Pass to draw().

    // Call the setup code that we left inside the base class:
    super.render_animation( caller );

    /**********************************
     Start coding down here!!!!
     **********************************/
        // From here on down it's just some example shapes drawn for you -- freely
        // replace them with your own!  Notice the usage of the Mat4 functions
        // translation(), scale(), and rotation() to generate matrices, and the
        // function times(), which generates products of matrices.

    const blue = color( 0,0,1,1 ), yellow = color( 1,0.7,0,1 ), green = color( 0,0.7,0,1 );

    const t = this.t = this.uniforms.animation_time/1000;

    // !!! Draw ground
    let floor_transform = Mat4.translation(0, 0, 0).times(Mat4.scale(10, 0.01, 10));
    this.shapes.box.draw( caller, this.uniforms, floor_transform, { ...this.materials.plastic, color: yellow } );

    // !!! Draw ball (for reference)
    let ball_transform = Mat4.translation(this.ball_location[0], this.ball_location[1], this.ball_location[2])
        .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));
    this.shapes.ball.draw( caller, this.uniforms, ball_transform, { ...this.materials.metal, color: blue } );

    // TODO: you should draw spline here.
    // this.controlPoints = []; // Array to store control points: [{ x, y, z }]
    // this.tangents = [];      // Array to store tangents: [{ sx, sy, sz }]
    // Compute the point at t = 0.5
    // if (t%4 == 0){
    let point = this.spline.computePoint(Math.abs(Math.sin(t)));
    // console.log(point); // { x: 0.5, y: 0.5, z: 0.5 }
    // this.ball_location = point;

    let ball_transform2 = Mat4.translation(point[0], point[1], point[2])
    .times(Mat4.scale(this.ball_radius, this.ball_radius, this.ball_radius));
    this.shapes.ball.draw( caller, this.uniforms, ball_transform2, { ...this.materials.metal, color: blue } );
    // }

    // Draw DEBUG SPLINE POINTS  /////////////
    // this.ball_location = vec3(x, y, z)
    const rad = 0.1;
    let controlPointsSpline = this.spline.getPoints();
    let tangentsSpline = this.spline.getTangents();
    // console.log(controlPointsSpline);
    // console.log(controlPointsSpline[0].x);
    

    // for (let i = 0; i < controlPointsSpline.length; i++){
    //   let local_ball_transform = Mat4.translation(controlPointsSpline[i].x, controlPointsSpline[i].y, controlPointsSpline[i].z)
    //   .times(Mat4.scale(rad, rad, rad));
    //   this.shapes.ball.draw( caller, this.uniforms, local_ball_transform, { ...this.materials.metal, color: green } );

    //   let local_ball_transform2 = Mat4.translation(controlPointsSpline[i].x + tangentsSpline[i].sx, 
    //                                                 controlPointsSpline[i].y + tangentsSpline[i].sy, 
    //                                                 controlPointsSpline[i].z + tangentsSpline[i].sz)
    //   .times(Mat4.scale(rad, rad, rad));
    //   this.shapes.ball.draw( caller, this.uniforms, local_ball_transform2, { ...this.materials.plastic, color: yellow } );

    //   // let square_transform = Mat4.translation(controlPointsSpline[i].x, controlPointsSpline[i].y, controlPointsSpline[i].z)
    //   // .times(Mat4.scale(0.05, 5, 0.05)).times(Mat4.rotation(0.5, 0.5, 0.5));
    //   // Correct transformation for the square
    //   let square_transform = Mat4.translation(controlPointsSpline[i].x, controlPointsSpline[i].y, controlPointsSpline[i].z) // Step 1: Translate to position
    // .times(Mat4.rotation(0.5, 0, 0, 1)) // Step 2: Rotate to align (rotate around Z-axis in this case)
    // .times(Mat4.scale(4, 0.1, 0.1)); // Step 3: Scale it to desired size/shape

    //   this.shapes.square.draw( caller, this.uniforms, square_transform, { ...this.materials.metal, color: blue } );
    // }


        // !!! Draw curve

    // // Sad, this is not working
    // const gl = caller.context;
    // gl.lineWidth(10);


    // this.sample_cnt = 1000;

    this.curve.draw(caller, this.uniforms);

    // this.curve.update(caller, this.uniforms, (t) => this.spline.computePoint(t));

    // const curve_fn = (t) => this.spline.computePoint(t);
    // this.curve = new Curve_Shape(curve_fn, this.sample_cnt);
    
    // add some fluctuation
    // if (this.curve_fn && this.sample_cnt === this.curve.sample_count) {
    //   this.curve.update(caller, this.uniforms,
    //       (s) => this.curve_fn(s).plus(vec3(Math.cos(this.t * s), Math.sin(this.t), 0)) );
    // }
    /**
     * 
4
0 1 2 1 0 0
5 5 5 0 1 0
9 9 9 4 4 4
19 19 9 5 -9 -44
     */
  }

  render_controls()
  {                                 // render_controls(): Sets up a panel of interactive HTML elements, including
    // buttons with key bindings for affecting this scene, and live info readouts.
    this.control_panel.innerHTML += "Part One:";
    this.new_line();
    this.key_triggered_button( "Parse Commands", [], this.parse_commands );
    this.new_line();
    this.key_triggered_button( "Draw", [], this.update_scene );
    this.new_line();
    this.key_triggered_button( "Load", [], this.load_spline );
    this.new_line();
    this.key_triggered_button( "Export", [], this.export_spline );
    this.new_line();
    // console.log("rendering controls");

    /* Some code for your reference
    this.key_triggered_button( "Copy input", [ "c" ], function() {
      let text = document.getElementById("input").value;
      console.log(text);
      document.getElementById("output").value = text;
    } );
    this.new_line();
    this.key_triggered_button( "Relocate", [ "r" ], function() {
      let text = document.getElementById("input").value;
      const words = text.split(' ');
      if (words.length >= 3) {
        const x = parseFloat(words[0]);
        const y = parseFloat(words[1]);
        const z = parseFloat(words[2]);
        this.ball_location = vec3(x, y, z)
        document.getElementById("output").value = "success";
      }
      else {
        document.getElementById("output").value = "invalid input";
      }
    } );
     */
  }

  parse_commands() {
    // document.getElementById("output").value = "parse_commands";
    //TODO
    let input_text = document.getElementById("input").value;
    // let output_text = document.getElementById("output").value;
    let text = input_text.trim();
    // document.getElementById("output").value = "hello there";
    let output_text = "";

    /*
    commands
    add point <x y z, sx, sy, sz>
    set tangent <index> <x y z>
    set point <index> <x y z>
    get_arc_length
    */
    console.log(text);
    const commands = text.split("\n"); // split multiple commands

    this.controlPoints = this.controlPoints || [];
    this.tangents = this.tangents || [];

    commands.forEach((command) => {
        command = command.trim();
        if (command.startsWith("add point")) {
          // const match = command.match(/^add point\s*([\d.\-\s]+),\s*([\d.\-]+),\s*([\d.\-]+),\s*([\d.\-]+)$/);          //add point <x y z, sx, sy, sz>
          const match = command.match(/^add point\s*([\d.\-]+)\s*([\d.\-]+)\s*([\d.\-]+)\s*([\d.\-]+)\s*([\d.\-]+)\s*([\d.\-]+)$/);          //add point <x y z, sx, sy, sz>
            if (match) {
                // Extract positions and tangents
                // const position = match[1].trim().split(" ").map(parseFloat);
                const position = [parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3])];
                // const tangent = match[2].trim().split(" ").map(parseFloat);
                const tangent = [parseFloat(match[4]), parseFloat(match[5]), parseFloat(match[6])]; // [4, 5, 6]

                // this.controlPoints.push(position);
                // this.tangents.push(tangent);
                output_text += `Added point: ${position}, tangent: ${tangent}\n`;
                // this.ball_location = vec3(position[0], position[1], position[2])
                
                this.spline.addPoint({ x: position[0], y: position[1], z: position[2] }, { sx: tangent[0], sy: tangent[1], sz: tangent[2] })

            } else {
                output_text += "Invalid 'add point' command.\n";
            }
        } else if (command.startsWith("set tangent")) {
            const match = command.match(/^set tangent\s*(\d+)\s*([\d.\-\s]+)$/);
            if (match) {
                const index = parseInt(match[1]);
                const tangent = match[2].trim().split(" ").map(parseFloat);
                console.log("index is " + index + " and tangent is " + tangent + " length " + this.tangents.length);

                // if (index >= 0 && index < this.tangents.length && tangent.length === 3) { // might have to check if index EXISTS???
                if (index >= 0 && index < this.spline.getTangents().length) {
                    // this.tangents[index] = tangent;
                    output_text += `Set tangent at index ${index}: ${tangent}\n`;
                    this.spline.setTangent(index, {sx: tangent[0], sy: tangent[1], sz: tangent[2]});
                } else {
                    output_text += "Invalid index or tangent for 'set tangent'.\n";
                }
            } else {
                output_text += "Invalid 'set tangent' command.\n";
            }
        } else if (command.startsWith("set point")) {
            const match = command.match(/^set point\s*(\d+)\s*([\d.\-\s]+)$/);
            if (match) {
                const index = parseInt(match[1]);
                const position = match[2].trim().split(" ").map(parseFloat);

                // if (index >= 0 && index < this.controlPoints.length && position.length === 3) { // again might have to check if index Exists...
                if (index >= 0 && index < this.spline.getPoints().length) {
                    // this.controlPoints[index] = position;
                    output_text += `Set point at index ${index}: ${position}\n`;
                    this.spline.setPoint(index, {x: position[0], y: position[1], z: position[2]});
                } else {
                    output_text += "Invalid index or point for 'set point'.\n";
                }
            } else {
                output_text += "Invalid 'set point' command.\n";
            }
        } else if (command === "get_arc_length") {
            if (this.spline.getPoints().length > 1) {
                const arcLength = this.spline.computeArcLength(); // uhh do arc length??? TODO
                // output_text += `Arc length: ${arcLength.toFixed(2)}\n`;
                // const arcLength = 0
                output_text += "arc length " + arcLength;
            } else {
                output_text += "Not enough points to compute arc length.\n" + this.spline.getPoints().length;
            }
        } else {
            output_text += `Unknown command: ${command}\n`;
        }
    });

    document.getElementById("output").value = output_text;
  }

  update_scene() { // callback for Draw button
    document.getElementById("output").value = "update_scene";
    //TODO
    // Ig just display or reset values? maybe set the actual spline values here instead of load and stuff?
    const curve_fn = (t) => this.spline.computePoint(t);
    this.curve = new Curve_Shape(curve_fn, this.sample_cnt);
  }

  load_spline() {
    document.getElementById("output").value = "load_spline";
    this.spline.load(document.getElementById("input").value);
    //TODO
    /* Format for load
    <n>
    <c_x1 c_y1 c_z1 t_x1 t_y1 t_z1>
    <c_x2 c_y2 c_z2 t_x2 t_y2 t_z2>
    ....
    <c_xn c_yn c_zn t_xn t_yn t_zn>

    */
  }

  export_spline() {
    document.getElementById("output").value = this.spline.export();
    // this.spline.export();
    //TODO
    /* Format for export
    <n>
    <c_x1 c_y1 c_z1 t_x1 t_y1 t_z1>
    <c_x2 c_y2 c_z2 t_x2 t_y2 t_z2>
    ....
    <c_xn c_yn c_zn t_xn t_yn t_zn>

    */
  }
}