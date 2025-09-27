/* Structure d'exemple du tableau pour comprendre les appels et le contenu
const elementsData = [
	{ number: 1, symbol: 'H', name: 'Hydrogen', maxBonds: 1, row: 1, col: 1, color: 0xFFFFFF, radius: 0.37, atomicMass: 1.008, electronegativity: 2.20, category: 'diatomic-nonmetal' }
]; */

const ELECTRON_GEOMETRIES = {
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
	],
	5: [
		new THREE.Vector3(0, 0, 1),
		new THREE.Vector3(0, 0, -1),
		new THREE.Vector3(1, 0, 0),
		new THREE.Vector3(-0.5, Math.sqrt(3) / 2, 0),
		new THREE.Vector3(-0.5, -Math.sqrt(3) / 2, 0)
	],
	6: [
		new THREE.Vector3(0, 0, 1),
		new THREE.Vector3(0, 0, -1),
		new THREE.Vector3(1, 0, 0),
		new THREE.Vector3(-1, 0, 0),
		new THREE.Vector3(0, 1, 0),
		new THREE.Vector3(0, -1, 0)
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

let moleculeInfoDiv, moleculeFormulaSpan, moleculeNameSpan;

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

	moleculeInfoDiv = document.getElementById('molecule-info');
	moleculeFormulaSpan = document.getElementById('molecule-formula');
	moleculeNameSpan = document.getElementById('molecule-name');

	populatePeriodicTable();
	updatePeriodicTableState();
	updateMoleculeInfo();
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
			}
			updateAtomGeometry(atomForBonding);
			updateAtomGeometry(targetAtom);
			atomForBonding.bonds.forEach(b => updateAtomGeometry(b.atom1 === atomForBonding ? b.atom2 : b.atom1));
			targetAtom.bonds.forEach(b => updateAtomGeometry(b.atom1 === targetAtom ? b.atom2 : b.atom1));
		}
		atomForBonding.mesh.material.emissive.setHex(0x000000);
		atomForBonding = null;
	}
}

function incrementBondOrder(atom1, atom2) {
	const bond = bonds.find(b => (b.atom1 === atom1 && b.atom2 === atom2) || (b.atom1 === atom2 && b.atom2 === atom1));
	if (bond) {
		if (getBondOrderSum(atom1) < atom1.data.maxBonds && getBondOrderSum(atom2) < atom2.data.maxBonds) {
			bond.order = Math.min(3, bond.order + 1);
			updatePeriodicTableState();
			updateMoleculeInfo();
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
		updateMoleculeInfo();
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

function getBondOrderSum(atom) {
	return atom.bonds.reduce((acc, bond) => acc + bond.order, 0);
}

function getLonePairs(atom) {
	const bondOrderSum = getBondOrderSum(atom);
	return Math.max(0, Math.floor((atom.data.valenceElectrons - bondOrderSum) / 2));
}

function getStericNumber(atom) {
	const lonePairs = getLonePairs(atom);
	return atom.bonds.length + lonePairs;
}

function updatePeriodicTableState() {
	const moleculeHasOpenSlots = atoms.some(atom => getBondOrderSum(atom) < atom.data.maxBonds);
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

		const hexColor = '#' + el.color.toString(16).padStart(6, '0');
		div.style.color = hexColor;

		div.innerHTML = `<span class="number">${el.number}</span>${el.symbol}`;
		div.dataset.symbol = el.symbol;

		div.title = `
Name: ${el.name}
Atomic Mass: ${el.atomicMass}
Electronegativity: ${el.electronegativity ?? 'N/A'}
Max Bonds: ${el.maxBonds}
Category: ${el.category}
`.trim();

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

	const possibleTargets = atoms.filter(a => getBondOrderSum(a) < a.data.maxBonds);

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
	updateMoleculeInfo();
	return atom;
}

function placeAtom(newData, targetAtom) {
	const newPosition = getNewAtomPosition(targetAtom, { data: newData });
	const newAtom = addAtom(newData, newPosition);
	createBond(newAtom, targetAtom);
	updateAtomGeometry(targetAtom);
	updateAtomGeometry(newAtom);
	updatePeriodicTableState();
	updateMoleculeInfo();
}

function getIdealBondLength(atom1, atom2, order) {
	return atom1.data.radius + atom2.data.radius - (order - 1) * 0.1;
}

function updateAtomGeometry(centralAtom) {
	const ligands = centralAtom.bonds.map(bond => bond.atom1 === centralAtom ? bond.atom2 : bond.atom1);
	const n = ligands.length;
	const stericNumber = getStericNumber(centralAtom);

	if (n === 0 || !ELECTRON_GEOMETRIES[stericNumber]) return;

	let idealDirections = [...ELECTRON_GEOMETRIES[stericNumber]];
	if (n === 1) {
		const ligand = ligands[0];
		const bond = centralAtom.bonds[0];
		const idealLength = getIdealBondLength(centralAtom, ligand, bond.order);
		const direction = new THREE.Vector3().subVectors(ligand.position, centralAtom.position).normalize();
		ligand.position.copy(centralAtom.position).add(direction.multiplyScalar(idealLength));
		ligand.velocity.set(0, 0, 0);
		return;
	}

	const actualDirections = ligands.map(ligand =>
		new THREE.Vector3().subVectors(ligand.position, centralAtom.position).normalize()
	);

	let bestRotation = new THREE.Quaternion();
	let minScore = Infinity;

	for (let i = 0; i < idealDirections.length; i++) {
		const q = new THREE.Quaternion().setFromUnitVectors(idealDirections[i], actualDirections[0]);
		for (let j = 0; j < 12; j++) {
			const axis = actualDirections[0].clone();
			const q_roll = new THREE.Quaternion().setFromAxisAngle(axis, (j / 12) * Math.PI * 2);
			const finalQ = q_roll.multiply(q);

			let currentScore = 0;
			const remainingIdeal = idealDirections.filter((v, index) => index !== i).map(v => v.clone().applyQuaternion(finalQ));
			const remainingActual = actualDirections.slice(1);

			remainingActual.forEach(actualVec => {
				let bestMatchDist = Infinity;
				remainingIdeal.forEach(idealVec => {
					bestMatchDist = Math.min(bestMatchDist, actualVec.distanceTo(idealVec));
				});
				currentScore += bestMatchDist;
			});

			if (currentScore < minScore) {
				minScore = currentScore;
				bestRotation = finalQ;
			}
		}
	}

	const rotatedIdealDirections = idealDirections.map(dir => dir.clone().applyQuaternion(bestRotation));
	const usedIndices = new Set();

	ligands.forEach(ligand => {
		let bestDirection = null;
		let bestIndex = -1;
		let minDistance = Infinity;
		const currentDirection = new THREE.Vector3().subVectors(ligand.position, centralAtom.position).normalize();

		rotatedIdealDirections.forEach((idealDir, i) => {
			if (!usedIndices.has(i)) {
				const d = currentDirection.distanceTo(idealDir);
				if (d < minDistance) {
					minDistance = d;
					bestDirection = idealDir;
					bestIndex = i;
				}
			}
		});

		if (bestIndex !== -1) {
			usedIndices.add(bestIndex);
			const bond = centralAtom.bonds.find(b => (b.atom1 === ligand || b.atom2 === ligand));
			const idealLength = getIdealBondLength(centralAtom, ligand, bond.order);
			ligand.position.copy(centralAtom.position).add(bestDirection.multiplyScalar(idealLength));
			ligand.velocity.set(0, 0, 0);
		}
	});
}

function getNewAtomPosition(targetAtom, newAtom) {
	const ligands = targetAtom.bonds.map(b => (b.atom1 === targetAtom ? b.atom2 : b.atom1));
	const futureStericNumber = ligands.length + 1 + getLonePairs(targetAtom);
	const idealDirections = ELECTRON_GEOMETRIES[futureStericNumber] || ELECTRON_GEOMETRIES[4];

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

	const usedDirections = ligands.map(l => new THREE.Vector3().subVectors(l.position, targetAtom.position).normalize());
	const rotatedIdeals = idealDirections.map(d => d.clone().applyQuaternion(rotation));

	let bestNewDirection = null;
	let maxMinDist = -1;

	rotatedIdeals.forEach(idealDir => {
		let minDistToUsed = Infinity;
		if (usedDirections.length > 0) {
			usedDirections.forEach(usedDir => {
				minDistToUsed = Math.min(minDistToUsed, idealDir.distanceTo(usedDir));
			});
		} else {
			minDistToUsed = 0;
		}

		if(minDistToUsed > maxMinDist) {
			maxMinDist = minDistToUsed;
			bestNewDirection = idealDir;
		}
	});

	bestNewDirection = bestNewDirection || rotatedIdeals[ligands.length];
	const idealLength = getIdealBondLength(targetAtom, newAtom, 1);
	return new THREE.Vector3().copy(targetAtom.position).add(bestNewDirection.multiplyScalar(idealLength));
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
	updateMoleculeInfo();
}

function updateMoleculeInfo() {
	if (atoms.length === 0) {
		moleculeInfoDiv.classList.remove('visible');
		return;
	}

	const composition = atoms.reduce((acc, atom) => {
		const symbol = atom.data.symbol;
		acc[symbol] = (acc[symbol] || 0) + 1;
		return acc;
	}, {});

	moleculeFormulaSpan.innerHTML = generateFormula(composition);
	moleculeNameSpan.textContent = generateName(composition);
	moleculeInfoDiv.classList.add('visible');
}

function generateFormula(composition) {
	const symbols = Object.keys(composition);
	symbols.sort((a, b) => {
		if (a === 'C' && b !== 'C') return -1;
		if (b === 'C' && a !== 'C') return 1;
		if (a === 'H' && b !== 'H') return symbols.includes('C') ? -1 : a.localeCompare(b);
		if (b === 'H' && a !== 'H') return symbols.includes('C') ? 1 : a.localeCompare(b);
		return a.localeCompare(b);
	});

	return symbols.map(symbol => {
		const count = composition[symbol];
		return count > 1 ? `${symbol}<sub>${count}</sub>` : symbol;
	}).join('');
}

function generateName(composition) {
	const GREEK_PREFIXES = { 1: 'mono', 2: 'di', 3: 'tri', 4: 'tetra', 5: 'penta', 6: 'hexa', 7: 'hepta', 8: 'octa', 9: 'nona', 10: 'deca', 11: 'undeca', 12: 'dodeca' };
	const ORGANIC_PREFIXES = { 1: 'meth', 2: 'eth', 3: 'prop', 4: 'but', 5: 'pent', 6: 'hex', 7: 'hept', 8: 'oct', 9: 'non', 10: 'dec' };
	const IDE_SUFFIXES = { 'Oxygen': 'oxide', 'Hydrogen': 'hydride', 'Carbon': 'carbide', 'Nitrogen': 'nitride', 'Phosphorus': 'phosphide', 'Sulfur': 'sulfide', 'Fluorine': 'fluoride', 'Chlorine': 'chloride', 'Bromine': 'bromide', 'Iodine': 'iodide', 'Selenium': 'selenide' };

	const createCanonicalFormula = (comp) => {
		const symbols = Object.keys(comp);
		const hasC = symbols.includes('C');
		symbols.sort((a, b) => {
			if (hasC) {
				if (a === 'C') return -1;
				if (b === 'C') return 1;
				if (a === 'H') return -1;
				if (b === 'H') return 1;
			}
			return a.localeCompare(b);
		});
		return symbols.map(s => `${s}${comp[s] > 1 ? comp[s] : ''}`).join('');
	};
	
	const formula = createCanonicalFormula(composition);

	const COMMON_MOLECULES = {
		'H2O': 'Water',
		'CO2': 'Carbon dioxide',
		'CO': 'Carbon monoxide',
		'NH3': 'Ammonia',
		'CH4': 'Methane',
		'H2O2': 'Hydrogen peroxide',
		'O3': 'Ozone',
		'N2O': 'Nitrous oxide',
		'NO2': 'Nitrogen dioxide',
		'NO': 'Nitric oxide',
		'SO2': 'Sulfur dioxide',
		'SO3': 'Sulfur trioxide',
		'H2S': 'Hydrogen sulfide',
		'HCl': 'Hydrogen chloride',
		'C6H6': 'Benzene',
		'C2H5OH': 'Ethanol',
		'CH3OH': 'Methanol',
		'CH3COOH': 'Acetic acid',
		'HCHO': 'Formaldehyde',
		'C3H8': 'Propane',
		'C4H10': 'Butane',
		'C2H6': 'Ethane',
		'C2H4': 'Ethene',
		'C2H2': 'Ethyne'
	};

	if (COMMON_MOLECULES[formula]) {
		return COMMON_MOLECULES[formula];
	}

	const symbols = Object.keys(composition);
	const elementCount = symbols.length;

	if (elementCount === 0) {
		return "";
	}

	if (elementCount === 1) {
		const symbol = symbols[0];
		const count = composition[symbol];
		const elementData = elementsData.find(el => el.symbol === symbol);
		if (!elementData) return "Unknown Element";
		if (count === 1) return elementData.name;
		const prefix = (GREEK_PREFIXES[count] || 'poly').replace('mono', '');
		return `${prefix.charAt(0).toUpperCase() + prefix.slice(1)}${elementData.name.toLowerCase()}`;
	}

	const nameBinaryInorganic = () => {
		const elements = symbols.map(s => elementsData.find(el => el.symbol === s));
		const [cation, anion] = elements.sort((a, b) => (a.electronegativity || 0) - (b.electronegativity || 0));

		const anionCount = composition[anion.symbol];
		let anionPrefix = (GREEK_PREFIXES[anionCount] || 'poly');
		const anionNameRoot = IDE_SUFFIXES[anion.name] || anion.name.toLowerCase().replace(/(?:ine|on|en|us|ur|ogen|ygen)$/, '') + 'ide';
		if ((anionPrefix.endsWith('a') || anionPrefix.endsWith('o')) && ['a', 'e', 'i', 'o', 'u'].includes(anionNameRoot[0])) {
			anionPrefix = anionPrefix.slice(0, -1);
		}
		const anionPart = (anionPrefix === 'mono' ? '' : anionPrefix) + anionNameRoot;

		const cationCount = composition[cation.symbol];
		const cationPrefix = cationCount > 1 ? GREEK_PREFIXES[cationCount] : '';
		const cationPart = cationPrefix + cation.name.toLowerCase();

		return `${cationPart} ${anionPart}`.charAt(0).toUpperCase() + `${cationPart} ${anionPart}`.slice(1);
	};

	const nameOrganicCompound = () => {
		const c = composition['C'] || 0;
		const h = composition['H'] || 0;
		const o = composition['O'] || 0;
		const n = composition['N'] || 0;
		const halogens = ['F', 'Cl', 'Br', 'I'].reduce((sum, s) => sum + (composition[s] || 0), 0);

		if (c > 20) return "Large organic molecule (polymer-like)";

		const backbonePrefix = ORGANIC_PREFIXES[c];
		if (!backbonePrefix) return "Complex organic compound";
		
		let baseName;
		let saturation = (2 * c + 2) - (h + halogens);

		if (o === 0 && n === 0 && halogens === 0) {
			if (saturation === 0) baseName = backbonePrefix + 'ane';
			else if (saturation === 2) baseName = backbonePrefix + 'ene';
			else if (saturation === 4) baseName = backbonePrefix + 'yne';
			else return `${backbonePrefix}ane-based hydrocarbon`;
			return baseName.charAt(0).toUpperCase() + baseName.slice(1);
		}
		
		const adjustedH = h - n;
		const remainingSaturation = (2 * c + 2) - (adjustedH + halogens);

		if (o >= 2 && adjustedH >= 1) {
			if (c > 0 && (2 * c) === h && o === 2) {
				return (backbonePrefix + 'anoic acid').charAt(0).toUpperCase() + (backbonePrefix + 'anoic acid').slice(1);
			}
		}

		if (o >= 1) {
			if (2 * c + 2 === h) {
				return (backbonePrefix + 'anol').charAt(0).toUpperCase() + (backbonePrefix + 'anol').slice(1);
			}
			if (2 * c === h) {
				return `Unsaturated ${backbonePrefix} framework with oxygen`;
			}
		}
		
		if (n >= 1) {
			if (2 * c + 3 === h + n) {
				return (backbonePrefix + 'anamine').charAt(0).toUpperCase() + (backbonePrefix + 'anamine').slice(1);
			}
		}
		
		let description = "Organic compound";
		const others = symbols.filter(s => !['C', 'H'].includes(s));
		if (others.length > 0) {
			const otherNames = others.map(s => elementsData.find(el => el.symbol === s).name.toLowerCase()).join(', ');
			description += ` containing ${otherNames}`;
		}
		return description;
	};

	const generateFallbackName = () => {
		const sortedElements = symbols
			.map(s => elementsData.find(el => el.symbol === s))
			.filter(Boolean)
			.sort((a, b) => (a.electronegativity || 0) - (b.electronegativity || 0));

		if (sortedElements.length !== symbols.length) return "Compound with unknown elements";

		const elementNames = sortedElements.map(el => el.name);
		
		const hasO = symbols.includes('O');
		const hasMetal = sortedElements.some(el => el.category.includes('metal'));

		if (hasO && hasMetal) return "Mixed metal oxide";
		if (hasO) return "Complex oxide";

		let nameList;
		if (elementNames.length > 2) {
			nameList = elementNames.slice(0, -1).join(', ') + `, and ${elementNames.slice(-1)}`;
		} else {
			nameList = elementNames.join(' and ');
		}
		return `Compound of ${nameList}`;
	};

	if (symbols.includes('C')) {
		return nameOrganicCompound();
	}

	if (elementCount === 2) {
		return nameBinaryInorganic();
	}

	return generateFallbackName();
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
		if (draggedAtom) {
			draggedAtom.mesh.position.copy(draggedAtom.position);
		}
		updatePhysics(deltaTime);
		updateBondMeshes();
	} else {
		updateBondMeshes();
	}

	controls.update();
	renderer.render(scene, camera);
}

init();