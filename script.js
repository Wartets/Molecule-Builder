/* Structure d'exemple du tableau pour comprendre les appels et le contenu
const elementsData = [
	{ number: 1, symbol: 'H', name: 'Hydrogen', maxBonds: 1, row: 1, col: 1, color: 0xFFFFFF, radius: 0.37, atomicMass: 1.008, electronegativity: 2.20, category: 'diatomic-nonmetal' }
]; */

const GEOMETRIES = {
	1: [new THREE.Vector3(1, 0, 0)],
	2: [
		new THREE.Vector3(1, 0, 0),
		new THREE.Vector3(-1, 0, 0)
	],
	3: [
		new THREE.Vector3(1, 0, 0),
		new THREE.Vector3(-0.5, Math.sqrt(3) / 2, 0),
		new THREE.Vector3(-0.5, -Math.sqrt(3) / 2, 0)
	],
	4: [
		new THREE.Vector3(1, 1, 1).normalize(),
		new THREE.Vector3(-1, -1, 1).normalize(),
		new THREE.Vector3(-1, 1, -1).normalize(),
		new THREE.Vector3(1, -1, -1).normalize()
	]
};

let scene, camera, renderer, controls;
let atoms = [];
let bonds = [];
let placementHelpers = [];
let atomToPlaceData = null;
let selectedAtom = null;
let atomForBonding = null;

let isCtrlPressed = false;
let isShiftPressed = false;
let draggedAtom = null;

let isPlacementModeActive = false;
let selectedHelperIndex = -1;

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
	updatePeriodicTableState();
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
	if (isPlacementModeActive) {
		if (event.key === 'ArrowRight') {
			selectedHelperIndex = (selectedHelperIndex + 1) % placementHelpers.length;
			highlightSelectedHelper();
		} else if (event.key === 'ArrowLeft') {
			selectedHelperIndex = (selectedHelperIndex - 1 + placementHelpers.length) % placementHelpers.length;
			highlightSelectedHelper();
		} else if (event.key === 'Enter') {
			const helper = placementHelpers[selectedHelperIndex];
			if (helper) {
				placeAtom(atomToPlaceData, helper.targetAtom);
			}
			cancelPlacement();
		} else if (event.key === 'Escape') {
			cancelPlacement();
		}
		return;
	}

	if (event.key === 'Control' && !isCtrlPressed) {
		isCtrlPressed = true;
		controls.enabled = false;
		renderer.domElement.style.cursor = 'pointer';
	}
	if (event.key === 'Shift' && !isShiftPressed) {
		isShiftPressed = true;
		controls.enabled = false;
		renderer.domElement.style.cursor = 'crosshair';
	}

	if (event.key === 'Escape') {
		if (atomToPlaceData) cancelPlacement();
		if (atomForBonding) {
			atomForBonding.mesh.material.emissive.setHex(0x000000);
			atomForBonding = null;
		}
		deselectAllAtoms();
	}
}

function onKeyUp(event) {
	if (event.key === 'Control') {
		isCtrlPressed = false;
		controls.enabled = !isShiftPressed && !isPlacementModeActive;
		renderer.domElement.style.cursor = isShiftPressed ? 'crosshair' : 'auto';
		if (draggedAtom) draggedAtom = null;
	}
	if (event.key === 'Shift') {
		isShiftPressed = false;
		controls.enabled = !isCtrlPressed && !isPlacementModeActive;
		renderer.domElement.style.cursor = isCtrlPressed ? 'pointer' : 'auto';
		if (atomForBonding) {
			atomForBonding.mesh.material.emissive.setHex(0x000000);
			atomForBonding = null;
		}
	}
}

function onMouseDown3D(event) {
	if (isPlacementModeActive) return;

	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	raycaster.setFromCamera(mouse, camera);

	const atomMeshes = atoms.map(a => a.mesh);
	const intersects = raycaster.intersectObjects(atomMeshes, false);

	if (intersects.length > 0) {
		const targetAtom = atoms.find(a => a.mesh === intersects[0].object);
		if (!targetAtom) return;

		if (isShiftPressed) {
			handleBondCreation(targetAtom);
		} else if (isCtrlPressed) {
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
		} else if (event.button === 0) {
			selectAtom(targetAtom);
		}
	} else if (event.button === 0) {
		deselectAllAtoms();
	}
}

function handleBondCreation(targetAtom) {
	if (!atomForBonding) {
		atomForBonding = targetAtom;
		atomForBonding.mesh.material.emissive.setHex(0x005588);
	} else {
		if (atomForBonding !== targetAtom) {
			const existingBond = bonds.find(b => (b.atom1 === atomForBonding && b.atom2 === targetAtom) || (b.atom1 === targetAtom && b.atom2 === atomForBonding));
			if (existingBond) {
				incrementBondOrder(atomForBonding, targetAtom);
			} else {
				createBond(atomForBonding, targetAtom);
				updateAtomGeometry(atomForBonding);
				updateAtomGeometry(targetAtom);
			}
		}
		atomForBonding.mesh.material.emissive.setHex(0x000000);
		atomForBonding = null;
	}
}


function incrementBondOrder(atom1, atom2) {
	const bond = bonds.find(b => (b.atom1 === atom1 && b.atom2 === atom2) || (b.atom1 === atom2 && b.atom2 === atom1));
	if (bond) {
		if (getCurrentValence(atom1) < atom1.data.maxBonds && getCurrentValence(atom2) < atom2.data.maxBonds) {
			bond.order = Math.min(3, bond.order + 1);
			updateAtomGeometry(atom1);
			updateAtomGeometry(atom2);
			updatePeriodicTableState();
		}
	}
}

function onMouseMove3D(event) {
	if (draggedAtom) {
		mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
		mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
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

function selectAtom(atomToSelect) {
	deselectAllAtoms();
	selectedAtom = atomToSelect;
	selectedAtom.mesh.material.emissive.setHex(0x555555);
}

function deselectAllAtoms() {
	if (selectedAtom) {
		selectedAtom.mesh.material.emissive.setHex(0x000000);
	}
	selectedAtom = null;
}

function deleteAtom(atomToDelete) {
	const neighbors = [];
	const bondsToRemove = bonds.filter(b => b.atom1 === atomToDelete || b.atom2 === atomToDelete);

	bondsToRemove.forEach(bond => {
		bond.meshes.forEach(m => scene.remove(m));
		const otherAtom = bond.atom1 === atomToDelete ? bond.atom2 : bond.atom1;
		neighbors.push(otherAtom);
		otherAtom.bonds = otherAtom.bonds.filter(b => b !== bond);
		bonds = bonds.filter(b => b !== bond);
	});

	scene.remove(atomToDelete.mesh);
	atoms = atoms.filter(a => a !== atomToDelete);

	neighbors.forEach(neighbor => updateAtomGeometry(neighbor));

	if (atoms.length === 0) {
		resetSimulation();
	} else {
		updatePeriodicTableState();
	}
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
		if (e.target.closest('button')) return;
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

function getCurrentValence(atom) {
	return atom.bonds.reduce((acc, bond) => acc + bond.order, 0);
}

function updatePeriodicTableState() {
	const moleculeHasOpenSlots = atoms.some(atom => getCurrentValence(atom) < atom.data.maxBonds);
	const elementsInTable = document.querySelectorAll('.element');

	elementsInTable.forEach(elDiv => {
		const symbol = elDiv.dataset.symbol;
		const elData = elementsData.find(e => e.symbol === symbol);
		if (!elData || elData.maxBonds === 0) {
			elDiv.classList.add('disabled');
			return;
		}

		if (atoms.length === 0) {
			elDiv.classList.remove('disabled');
		} else {
			if (moleculeHasOpenSlots) {
				elDiv.classList.remove('disabled');
			} else {
				elDiv.classList.add('disabled');
			}
		}
	});
}

function populatePeriodicTable() {
	const table = document.getElementById('periodic-table');
	elementsData.forEach(el => {
		const div = document.createElement('div');
		div.className = 'element';
		div.style.gridRow = el.row;
		div.style.gridColumn = el.col;
		const hexColor ='#'+ el.color.toString(16).padStart(6,'0');
		div.style.color = hexColor;
		div.innerHTML = `<span class="number">${el.number}</span>${el.symbol}`;
		div.dataset.symbol = el.symbol;
		div.addEventListener('click', () => prepareToAddAtom(el.symbol));
		table.appendChild(div);
	});
}

function prepareToAddAtom(symbol) {
	if (atomToPlaceData || isPlacementModeActive) return;
	const data = elementsData.find(e => e.symbol === symbol);
	if (!data) return;

	if (atoms.length === 0) {
		addAtom(data);
		updatePeriodicTableState();
		return;
	}

	const possibleTargets = atoms.filter(a => getCurrentValence(a) < a.data.maxBonds);

	if (possibleTargets.length === 0) {
		return;
	}

	if (possibleTargets.length === 1) {
		placeAtom(data, possibleTargets[0]);
	} else {
		atomToPlaceData = data;
		isPlacementModeActive = true;
		selectedHelperIndex = 0;
		createPlacementHelpers(possibleTargets, data);
	}
}

function createPlacementHelpers(targetAtoms, newData) {
	cancelPlacement(true);
	controls.enabled = false;

	targetAtoms.forEach(target => {
		const helperGeometry = new THREE.SphereGeometry(newData.radius, 16, 16);
		const helperMaterial = new THREE.MeshStandardMaterial({
			color: 0x00ff00,
			transparent: true,
			opacity: 0.5,
			emissive: 0x000000
		});
		const mesh = new THREE.Mesh(helperGeometry, helperMaterial);

		const tempNewAtom = { data: newData };
		const position = getNewAtomPosition(target, tempNewAtom);
		mesh.position.copy(position);

		placementHelpers.push({ mesh, targetAtom: target });
		scene.add(mesh);
	});
	highlightSelectedHelper();
}

function highlightSelectedHelper() {
	placementHelpers.forEach((helper, index) => {
		if (index === selectedHelperIndex) {
			helper.mesh.material.emissive.setHex(0x008800);
			helper.mesh.material.opacity = 0.7;
		} else {
			helper.mesh.material.emissive.setHex(0x000000);
			helper.mesh.material.opacity = 0.5;
		}
	});
}

function cancelPlacement(isInternalCall = false) {
	placementHelpers.forEach(h => scene.remove(h.mesh));
	placementHelpers = [];
	if (!isInternalCall) {
		atomToPlaceData = null;
		isPlacementModeActive = false;
		selectedHelperIndex = -1;
	}
	controls.enabled = !isCtrlPressed && !isShiftPressed;
}

function addAtom(data, position) {
	const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
	const material = new THREE.MeshStandardMaterial({ color: data.color, roughness: 0.5, metalness: 0.2, emissive: 0x000000 });
	const mesh = new THREE.Mesh(geometry, material);
	const atom = {
		mesh: mesh,
		data: data,
		position: position || new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2),
		velocity: new THREE.Vector3(),
		force: new THREE.Vector3(),
		bonds: []
	};
	atom.mesh.position.copy(atom.position);
	atoms.push(atom);
	scene.add(mesh);
	return atom;
}

function placeAtom(newData, targetAtom) {
	const newPosition = getNewAtomPosition(targetAtom, { data: newData });
	const newAtom = addAtom(newData, newPosition);
	createBond(newAtom, targetAtom);
	updateAtomGeometry(targetAtom);
	updatePeriodicTableState();
}

function getIdealBondLength(atom1, atom2, order) {
	return atom1.data.radius + atom2.data.radius - (order - 1) * 0.15;
}

function updateAtomGeometry(centralAtom) {
	const ligands = centralAtom.bonds.map(bond => bond.atom1 === centralAtom ? bond.atom2 : bond.atom1);
	const n = ligands.length;

	if (n === 0) return;

	if (n === 1) {
		const ligand = ligands[0];
		const bond = centralAtom.bonds[0];
		const idealLength = getIdealBondLength(centralAtom, ligand, bond.order);
		const direction = new THREE.Vector3().subVectors(ligand.position, centralAtom.position).normalize();
		ligand.position.copy(centralAtom.position).add(direction.multiplyScalar(idealLength));
		ligand.velocity.set(0, 0, 0);
		return;
	}

	const idealDirections = GEOMETRIES[n] || GEOMETRIES[4];
	if (!idealDirections) return;

	const actualDirections = ligands.map(ligand =>
		new THREE.Vector3().subVectors(ligand.position, centralAtom.position).normalize()
	);

	const q = new THREE.Quaternion();
	const from = new THREE.Vector3(0, 0, 1);
	q.setFromUnitVectors(from, actualDirections[0]);

	const tempVec = idealDirections[1].clone().applyQuaternion(q);
	const angle = tempVec.angleTo(actualDirections[1]);
	const axis = new THREE.Vector3().crossVectors(tempVec, actualDirections[1]).normalize();

	const q2 = new THREE.Quaternion().setFromAxisAngle(axis, angle);
	const finalQ = q2.multiply(q);

	ligands.forEach((ligand, i) => {
		const bond = centralAtom.bonds.find(b => (b.atom1 === ligand || b.atom2 === ligand));
		const idealLength = getIdealBondLength(centralAtom, ligand, bond.order);
		const newDirection = idealDirections[i].clone().applyQuaternion(finalQ);
		ligand.position.copy(centralAtom.position).add(newDirection.multiplyScalar(idealLength));
		ligand.velocity.set(0, 0, 0);
	});
}

function getNewAtomPosition(targetAtom, newAtom) {
	const ligands = targetAtom.bonds.map(b => (b.atom1 === targetAtom ? b.atom2 : b.atom1));
	const n = ligands.length + 1;
	const idealDirections = GEOMETRIES[n] || GEOMETRIES[4];

	let rotation = new THREE.Quaternion();
	if (ligands.length > 0) {
		const actualDir = new THREE.Vector3().subVectors(ligands[0].position, targetAtom.position).normalize();
		rotation.setFromUnitVectors(idealDirections[0], actualDir);
	}

	if (ligands.length > 1) {
		const actualDir2 = new THREE.Vector3().subVectors(ligands[1].position, targetAtom.position).normalize();
		const idealDir2Rotated = idealDirections[1].clone().applyQuaternion(rotation);
		const angle = idealDir2Rotated.angleTo(actualDir2);
		const axis = new THREE.Vector3().crossVectors(idealDir2Rotated, actualDir2).normalize();
		const rot2 = new THREE.Quaternion().setFromAxisAngle(axis, angle);
		rotation.premultiply(rot2);
	}

	const newDirection = idealDirections[n - 1].clone().applyQuaternion(rotation);
	const idealLength = getIdealBondLength(targetAtom, newAtom, 1);
	return new THREE.Vector3().copy(targetAtom.position).add(newDirection.multiplyScalar(idealLength));
}

function createBond(atom1, atom2) {
	const existingBond = bonds.find(b => (b.atom1 === atom1 && b.atom2 === atom2) || (b.atom1 === atom2 && b.atom2 === atom1));
	if (!existingBond) {
		const bond = { atom1, atom2, order: 1, meshes: [] };
		bonds.push(bond);
		atom1.bonds.push(bond);
		atom2.bonds.push(bond);
		updateBondMeshes();
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
		const { atom1, atom2, order } = bond;
		const idealLength = getIdealBondLength(atom1, atom2, order);
		const delta = new THREE.Vector3().subVectors(atom1.position, atom2.position);
		const distance = delta.length();
		const displacement = distance - idealLength;
		const force = delta.normalize().multiplyScalar(-bondStrength * displacement * order);
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

function updateBondMeshes() {
	const material = new THREE.MeshStandardMaterial({ color: 0x666666, roughness: 0.8 });
	const bondRadius = 0.1;
	const geometry = new THREE.CylinderGeometry(bondRadius, bondRadius, 1, 8);

	bonds.forEach(bond => {
		while (bond.meshes.length < bond.order) {
			const mesh = new THREE.Mesh(geometry, material.clone());
			bond.meshes.push(mesh);
			scene.add(mesh);
		}
		while (bond.meshes.length > bond.order) {
			scene.remove(bond.meshes.pop());
		}

		const { atom1, atom2, meshes } = bond;
		if (!meshes.length) return;
		const start = atom1.position;
		const end = atom2.position;
		const distance = start.distanceTo(end);
		const direction = new THREE.Vector3().subVectors(end, start).normalize();
		const up = new THREE.Vector3(0, 1, 0);
		const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction);
		const offsetDirection = Math.abs(direction.dot(up)) > 0.99 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3().crossVectors(direction, up).normalize();

		for (let i = 0; i < meshes.length; i++) {
			const mesh = meshes[i];
			const normalizedIndex = (meshes.length > 1) ? (i - (meshes.length - 1) / 2) : 0;
			const offset = offsetDirection.clone().multiplyScalar(normalizedIndex * bondRadius * 2.5);
			mesh.scale.y = distance;
			mesh.position.copy(start).add(end).divideScalar(2).add(offset);
			mesh.quaternion.copy(quaternion);
		}
	});
}

function resetSimulation() {
	cancelPlacement();
	atoms.forEach(atom => scene.remove(atom.mesh));
	bonds.forEach(bond => bond.meshes.forEach(mesh => scene.remove(mesh)));
	atoms = [];
	bonds = [];
	selectedAtom = null;
	draggedAtom = null;
	atomForBonding = null;
	updatePeriodicTableState();
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
	const elapsedTime = clock.getElapsedTime();

	if (isPlacementModeActive && placementHelpers.length > 0) {
		const pulse = Math.sin(elapsedTime * 8) * 0.05 + 1.0;
		const selectedHelper = placementHelpers[selectedHelperIndex];
		if (selectedHelper) {
			selectedHelper.mesh.scale.set(pulse, pulse, pulse);
		}
	}

	if (atoms.length > 0 && !isPlacementModeActive) {
		if (draggedAtom) draggedAtom.mesh.position.copy(draggedAtom.position);
		updatePhysics(deltaTime);
		updateBondMeshes();
	} else {
        updateBondMeshes();
    }

	controls.update();
	renderer.render(scene, camera);
}

init();