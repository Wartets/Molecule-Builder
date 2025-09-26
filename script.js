const elementsData = [
	{ number: 1, symbol: 'H', valence: 1, row: 1, col: 1, color: 0xFFFFFF, radius: 0.35 },
	{ number: 2, symbol: 'He', valence: 0, row: 1, col: 18, color: 0xD4BFFF, radius: 0.31 },
	{ number: 3, symbol: 'Li', valence: 1, row: 2, col: 1, color: 0xB5FF00, radius: 1.45 },
	{ number: 4, symbol: 'Be', valence: 2, row: 2, col: 2, color: 0x82D99C, radius: 1.05 },
	{ number: 5, symbol: 'B', valence: 3, row: 2, col: 13, color: 0xFFC780, radius: 0.85 },
	{ number: 6, symbol: 'C', valence: 4, row: 2, col: 14, color: 0x909090, radius: 0.70 },
	{ number: 7, symbol: 'N', valence: 5, row: 2, col: 15, color: 0x3050F8, radius: 0.65 },
	{ number: 8, symbol: 'O', valence: 6, row: 2, col: 16, color: 0xFF0D0D, radius: 0.60 },
	{ number: 9, symbol: 'F', valence: 7, row: 2, col: 17, color: 0x90E050, radius: 0.50 },
	{ number: 10, symbol: 'Ne', valence: 8, row: 2, col: 18, color: 0x9E7AFF, radius: 0.38 },
	{ number: 11, symbol: 'Na', valence: 1, row: 3, col: 1, color: 0xAB5CF2, radius: 1.80 },
	{ number: 12, symbol: 'Mg', valence: 2, row: 3, col: 2, color: 0x8AFF00, radius: 1.50 },
	{ number: 13, symbol: 'Al', valence: 3, row: 3, col: 13, color: 0xBFA6A6, radius: 1.25 },
	{ number: 14, symbol: 'Si', valence: 4, row: 3, col: 14, color: 0xF0C8A0, radius: 1.10 },
	{ number: 15, symbol: 'P', valence: 5, row: 3, col: 15, color: 0xFF8000, radius: 1.00 },
	{ number: 16, symbol: 'S', valence: 6, row: 3, col: 16, color: 0xFFFF30, radius: 1.00 },
	{ number: 17, symbol: 'Cl', valence: 7, row: 3, col: 17, color: 0x1FF01F, radius: 1.00 },
	{ number: 18, symbol: 'Ar', valence: 8, row: 3, col: 18, color: 0x80D1F5, radius: 0.71 },
	{ number: 19, symbol: 'K', valence: 1, row: 4, col: 1, color: 0x8F40D4, radius: 2.20 },
	{ number: 20, symbol: 'Ca', valence: 2, row: 4, col: 2, color: 0x3DFF00, radius: 1.80 },
	{ number: 21, symbol: 'Sc', valence: 3, row: 4, col: 3, color: 0xE6E6E6, radius: 1.60 },
	{ number: 22, symbol: 'Ti', valence: 4, row: 4, col: 4, color: 0xBFC2C7, radius: 1.40 },
	{ number: 23, symbol: 'V', valence: 5, row: 4, col: 5, color: 0xA6A6AB, radius: 1.35 },
	{ number: 24, symbol: 'Cr', valence: 6, row: 4, col: 6, color: 0x8A99C7, radius: 1.40 },
	{ number: 25, symbol: 'Mn', valence: 7, row: 4, col: 7, color: 0x9C7AC7, radius: 1.40 },
	{ number: 26, symbol: 'Fe', valence: 8, row: 4, col: 8, color: 0xE06633, radius: 1.40 },
];

let scene, camera, renderer, controls;
let atoms = [];
let bonds = [];

const bondTargets = { H: 1, He: 0, Li: 1, Be: 2, B: 3, C: 4, N: 3, O: 2, F: 1, Ne: 0, Na: 1, Mg: 2, Al: 3, Si: 4, P: 3, S: 2, Cl: 1, Ar: 0, K: 1, Ca: 2, Sc: 3, Ti: 4, V: 5, Cr: 6, Mn: 7, Fe: 8 };

let isCtrlPressed = false;
let draggedAtom = null;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const dragPlane = new THREE.Plane();
const dragOffset = new THREE.Vector3();
const intersectionPoint = new THREE.Vector3();

function init() {
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0x111111);

	camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
	camera.position.z = 15;

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);

	const ambientLight = new THREE.AmbientLight(0xcccccc, 0.6);
	scene.add(ambientLight);

	const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
	directionalLight.position.set(1, 1, 0.5).normalize();
	scene.add(directionalLight);

	controls = new THREE.OrbitControls(camera, renderer.domElement);
	controls.enableDamping = true;
	controls.dampingFactor = 0.05;
	controls.screenSpacePanning = false;
	controls.minDistance = 2;
	controls.maxDistance = 50;

	populatePeriodicTable();
	initUI();
	initEventListeners();
	
	window.addEventListener('resize', onWindowResize, false);

	animate();
}

function initEventListeners() {
	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('keyup', onKeyUp);
	renderer.domElement.addEventListener('mousedown', onMouseDown3D);
	renderer.domElement.addEventListener('mousemove', onMouseMove3D);
	renderer.domElement.addEventListener('mouseup', onMouseUp3D);
	renderer.domElement.addEventListener('contextmenu', (event) => {
		if (isCtrlPressed) event.preventDefault();
	});
}

function onKeyDown(event) {
	if (event.key === 'Control' && !isCtrlPressed) {
		isCtrlPressed = true;
		controls.enabled = false;
		renderer.domElement.style.cursor = 'pointer';
	}
}

function onKeyUp(event) {
	if (event.key === 'Control') {
		isCtrlPressed = false;
		controls.enabled = true;
		renderer.domElement.style.cursor = 'auto';
		if (draggedAtom) {
			draggedAtom = null;
		}
	}
}

function onMouseDown3D(event) {
	if (!isCtrlPressed) return;

	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

	raycaster.setFromCamera(mouse, camera);
	const atomMeshes = atoms.map(a => a.mesh);
	const intersects = raycaster.intersectObjects(atomMeshes);

	if (intersects.length > 0) {
		const targetAtom = atoms.find(a => a.mesh === intersects[0].object);
		if (!targetAtom) return;
		
		if (event.button === 0) {
			draggedAtom = targetAtom;
			renderer.domElement.style.cursor = 'grabbing';
			dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(dragPlane.normal), draggedAtom.position);
			if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
				dragOffset.copy(draggedAtom.position).sub(intersectionPoint);
			}
		} else if (event.button === 2) {
			deleteAtom(targetAtom);
		}
	}
}

function onMouseMove3D(event) {
	if (draggedAtom) {
		mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

		raycaster.setFromCamera(mouse, camera);

		if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
			const newPosition = intersectionPoint.add(dragOffset);
			draggedAtom.position.copy(newPosition);
			draggedAtom.velocity.set(0, 0, 0); 
		}
	}
}

function onMouseUp3D(event) {
	if (event.button === 0 && draggedAtom) {
		draggedAtom = null;
		renderer.domElement.style.cursor = isCtrlPressed ? 'pointer' : 'auto';
	}
}

function deleteAtom(atomToDelete) {
	const bondsToRemove = bonds.filter(b => b.atom1 === atomToDelete || b.atom2 === atomToDelete);
	bondsToRemove.forEach(bond => {
		scene.remove(bond.mesh);
		const otherAtom = bond.atom1 === atomToDelete ? bond.atom2 : bond.atom1;
		otherAtom.bonds = otherAtom.bonds.filter(b => b !== bond);
	});

	bonds = bonds.filter(b => !bondsToRemove.includes(b));
	scene.remove(atomToDelete.mesh);
	atoms = atoms.filter(a => a !== atomToDelete);
}

function initUI() {
	const uiContainer = document.getElementById('ui-container');
	const header = uiContainer.querySelector('.header');
	const toggleButton = document.getElementById('toggle-button');
	const settingsIcon = document.getElementById('settings-icon');
	
	uiContainer.style.left = '15px';
	uiContainer.style.top = '15px';

	toggleButton.addEventListener('click', () => {
		uiContainer.classList.add('hidden');
		settingsIcon.classList.remove('hidden');
	});

	settingsIcon.addEventListener('click', () => {
		uiContainer.classList.remove('hidden');
		settingsIcon.classList.add('hidden');
	});
	
	document.getElementById('reset-button').addEventListener('click', resetSimulation);

	let isDragging = false;
	let offsetX, offsetY;

	const onMouseDown = (e) => {
		if (e.target === toggleButton) return;
		isDragging = true;
		offsetX = e.clientX - uiContainer.getBoundingClientRect().left;
		offsetY = e.clientY - uiContainer.getBoundingClientRect().top;
		document.addEventListener('mousemove', onMouseMove);
		document.addEventListener('mouseup', onMouseUp);
	};

	const onMouseMove = (e) => {
		if (!isDragging) return;
		e.preventDefault();
		const x = e.clientX - offsetX;
		const y = e.clientY - offsetY;
		uiContainer.style.left = `${x}px`;
		uiContainer.style.top = `${y}px`;
	};

	const onMouseUp = () => {
		isDragging = false;
		document.removeEventListener('mousemove', onMouseMove);
		document.removeEventListener('mouseup', onMouseUp);
	};

	header.addEventListener('mousedown', onMouseDown);
}

function populatePeriodicTable() {
	const table = document.getElementById('periodic-table');
	elementsData.forEach(el => {
		const div = document.createElement('div');
		div.className = 'element';
		div.style.gridRow = el.row;
		div.style.gridColumn = el.col;
		div.innerHTML = `<span class="number">${el.number}</span>${el.symbol}`;
		div.dataset.symbol = el.symbol;
		div.addEventListener('click', () => addAtom(el.symbol));
		table.appendChild(div);
	});
}

function addAtom(symbol) {
	const data = elementsData.find(e => e.symbol === symbol);
	if (!data) return;

	const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
	const material = new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.5, metalness: 0.2 });
	const mesh = new THREE.Mesh(geometry, material);
	
	const atom = {
		mesh: mesh,
		data: data,
		position: new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2),
		velocity: new THREE.Vector3(),
		force: new THREE.Vector3(),
		bonds: []
	};

	if (atoms.length > 0) {
		atom.position.add(atoms[atoms.length - 1].position);
	}

	atom.mesh.position.copy(atom.position);
	atoms.push(atom);
	scene.add(mesh);

	createBonds(atom);
}

function createBonds(newAtom) {
	const sortedAtoms = atoms
		.filter(a => a !== newAtom && a.bonds.length < bondTargets[a.data.symbol])
		.sort((a, b) => newAtom.position.distanceTo(a.position) - newAtom.position.distanceTo(b.position));

	let bondsToCreate = bondTargets[newAtom.data.symbol];
	if (atoms.length === 1) return;

	for (let i = 0; i < sortedAtoms.length && bondsToCreate > 0 && newAtom.bonds.length < bondTargets[newAtom.data.symbol]; i++) {
		const otherAtom = sortedAtoms[i];
		
		const existingBond = bonds.find(b => (b.atom1 === newAtom && b.atom2 === otherAtom) || (b.atom1 === otherAtom && b.atom2 === newAtom));
		if (existingBond) continue;

		const bond = { atom1: newAtom, atom2: otherAtom };
		const material = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8 });
		const cylinder = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
		bond.mesh = new THREE.Mesh(cylinder, material);
		
		bonds.push(bond);
		newAtom.bonds.push(bond);
		otherAtom.bonds.push(bond);
		scene.add(bond.mesh);

		bondsToCreate--;
	}
}

function updatePhysics(deltaTime) {
	if (atoms.length < 2) return;

	const repulsionStrength = 0.8;
	const bondStrength = 30.0;
	const damping = 0.95;

	atoms.forEach(atom => atom.force.set(0, 0, 0));

	for (let i = 0; i < atoms.length; i++) {
		for (let j = i + 1; j < atoms.length; j++) {
			const atom1 = atoms[i];
			const atom2 = atoms[j];
			const delta = new THREE.Vector3().subVectors(atom1.position, atom2.position);
			const distance = delta.length();
			if (distance > 0) {
				const force = delta.multiplyScalar(repulsionStrength / (distance * distance * distance));
				atom1.force.add(force);
				atom2.force.sub(force);
			}
		}
	}

	bonds.forEach(bond => {
		const { atom1, atom2 } = bond;
		const idealLength = atom1.data.radius + atom2.data.radius;
		const delta = new THREE.Vector3().subVectors(atom1.position, atom2.position);
		const distance = delta.length();
		const displacement = distance - idealLength;
		const force = delta.normalize().multiplyScalar(-bondStrength * displacement);
		atom1.force.add(force);
		atom2.force.sub(force);
	});

	atoms.forEach(atom => {
		if (atom === draggedAtom) return; 
		atom.velocity.add(atom.force.multiplyScalar(deltaTime));
		atom.velocity.multiplyScalar(damping);
		atom.position.add(atom.velocity.clone().multiplyScalar(deltaTime));
		atom.mesh.position.copy(atom.position);
	});
}

function updateBonds() {
	bonds.forEach(bond => {
		const { atom1, atom2, mesh } = bond;
		const start = atom1.position;
		const end = atom2.position;
		const distance = start.distanceTo(end);
		
		mesh.scale.y = distance;
		mesh.position.copy(start).add(end).divideScalar(2);
		
		const direction = new THREE.Vector3().subVectors(end, start).normalize();
		const up = new THREE.Vector3(0, 1, 0);
		const quaternion = new THREE.Quaternion();
		quaternion.setFromUnitVectors(up, direction);
		mesh.quaternion.copy(quaternion);
	});
}

function resetSimulation() {
	atoms.forEach(atom => scene.remove(atom.mesh));
	bonds.forEach(bond => scene.remove(bond.mesh));
	atoms = [];
	bonds = [];
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
}

const clock = new THREE.Clock();
function animate() {
	requestAnimationFrame(animate);
	const deltaTime = Math.min(clock.getDelta(), 0.1);
	
	if (atoms.length > 0) {
		if(draggedAtom) draggedAtom.mesh.position.copy(draggedAtom.position);
		updatePhysics(deltaTime);
		updateBonds();
	}
	
	controls.update();
	renderer.render(scene, camera);
}

init();