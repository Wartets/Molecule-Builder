# Molecule Builder

Molecule Builder is an interactive web-based tool that allows you to create, visualize, and manipulate 3D models of chemical molecules. Built with Three.js, it provides an intuitive interface for students, educators, and chemistry enthusiasts to explore molecular structures.

**[Live Demo](https://wartets.github.io/Nuage/)**

## Features

-   **Interactive 3D Canvas:** View and manipulate molecules in a dynamic 3D space.
-   **Multiple Build Methods:**
    -   **Periodic Table:** Select elements from a clickable periodic table to add atoms.
    -   **Formula Input:** Automatically generate molecules by typing common names (e.g., "Water"), chemical formulas (e.g., "H2O"), or SMILES-like notations (e.g., "C=C", "C1=CC=CC=C1").
-   **Atom & Bond Manipulation:**
    -   Drag and drop atoms to reposition them.
    -   Create single, double, or triple bonds between atoms.
    -   Delete individual atoms and their connections.
-   **Intelligent Structure Prediction:**
    -   Automatic placement helpers suggest optimal bonding positions based on VSEPR theory.
    -   Valence and formal charge validation with visual error indicators.
    -   Automatic saturation of hydrogen atoms for organic compounds.
-   **Advanced Visualization Tools:**
    -   Toggle the display of **Van der Waals surfaces** with adjustable opacity and scale.
    -   Visualize **lone pairs** of electrons.
    -   Show **formal charges** on atoms.
-   **Dynamic Information Display:**
    -   The molecular formula and common name are updated in real-time as you build.
-   **User-Friendly Interface:**
    -   Intuitive mouse and touch controls.
    -   Resizable and draggable UI panels that snap into place.
    -   Responsive design for both desktop and mobile devices.
    -   Fullscreen mode for an immersive experience.

## Controls & Shortcuts

#### Mouse Controls
-   **Rotate View:** `Left-click` + `Drag`
-   **Pan View:** `Right-click` + `Drag`
-   **Zoom View:** `Scroll wheel`
-   **Move Atom:** `Ctrl` + `Left-click` + `Drag`
-   **Delete Atom:** `Ctrl` + `Right-click`
-   **Create/Increment Bond:** `Shift` + `Click` on two atoms sequentially.

#### Touchscreen Controls
-   **Create/Increment Bond:** `Tap` on two atoms sequentially.
-   **Delete Atom:** `Double-tap` an atom.
-   **Move Atom:** `Long-press` and `drag` an atom.

#### Keyboard Shortcuts
-   **Cancel Action:** `Esc`
-   **Cycle Placement Helpers:** `←` / `→`
-   **Confirm Placement:** `Enter`

## Technologies Used

-   **Frontend:** HTML5, CSS3, JavaScript
-   **3D Graphics:** [Three.js](https://threejs.org/)

## Getting Started

As this is a pure front-end project, there are no build steps required.

1.  Clone the repository:
    ```sh
    git clone https://github.com/wartets/Nuage.git
    ```
2.  Navigate to the project directory:
    ```sh
    cd Nuage
    ```
3.  Open the `index.html` file in your web browser.
