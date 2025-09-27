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
	if (typeof elementsData === 'undefined' || !Array.isArray(elementsData)) {
		throw new Error("Missing or invalid 'elementsData'.");
	}

	const CHEMICAL_DATA = {
		GREEK_PREFIXES: {
			1: '', 2: 'di', 3: 'tri', 4: 'tetra', 5: 'penta', 6: 'hexa', 7: 'hepta', 8: 'octa', 9: 'nona', 10: 'deca',
			11: 'undeca', 12: 'dodeca', 13: 'trideca', 14: 'tetradeca', 15: 'pentadeca', 16: 'hexadeca', 17: 'heptadeca', 18: 'octadeca', 19: 'nonadeca',
			20: 'icosa', 21: 'henicosa', 22: 'docosa', 23: 'tricosa', 24: 'tetracosa', 25: 'pentacosa', 26: 'hexacosa', 27: 'heptacosa', 28: 'octacosa', 29: 'nonacosa',
			30: 'triaconta', 31: 'hentriaconta', 32: 'dotriaconta', 40: 'tetraconta', 50: 'pentaconta', 60: 'hexaconta', 70: 'heptaconta', 80: 'octaconta', 90: 'nonaconta', 100: 'hecta'
		},
		ORGANIC_PREFIXES: {
			1: 'meth', 2: 'eth', 3: 'prop', 4: 'but', 5: 'pent', 6: 'hex', 7: 'hept', 8: 'oct', 9: 'non', 10: 'dec',
			11: 'undec', 12: 'dodec', 13: 'tridec', 14: 'tetradec', 15: 'pentadec', 16: 'hexadec', 17: 'heptadec', 18: 'octadec', 19: 'nonadec',
			20: 'icos', 21: 'henicos', 22: 'docos', 23: 'tricos', 24: 'tetracos', 25: 'pentacos', 26: 'hexacos', 27: 'heptacos', 28: 'octacos', 29: 'nonacos',
			30: 'triacont', 31: 'hentriacont', 40: 'tetracont', 50: 'pentacont', 60: 'hexacont', 70: 'heptacont', 80: 'octacont', 90: 'nonacont', 100: 'hect'
		},
		ELEMENT_ROOTS: {
			'O': 'ox', 'H': 'hydr', 'C': 'carb', 'N': 'nitr', 'P': 'phosph', 'S': 'sulf', 'F': 'fluor', 'Cl': 'chlor',
			'Br': 'brom', 'I': 'iod', 'Se': 'selen', 'As': 'arsen', 'Te': 'tellur', 'B': 'bor', 'Si': 'silic', 'Sb': 'stib',
			'At': 'astat', 'Fe': 'ferr', 'Cu': 'cupr', 'Au': 'aur', 'Ag': 'argent', 'Pb': 'plumb', 'Sn': 'stann', 'Hg': 'mercur',
			'Mn': 'mangan', 'Cr': 'chrom', 'Mo': 'molybd', 'W': 'tungst', 'V': 'vanad', 'Ti': 'titan', 'Zr': 'zircon',
			'Al': 'alumin', 'Ga': 'gall', 'Zn': 'zinc', 'Ni': 'nickel', 'Co': 'cobalt', 'Pt': 'platin', 'Pd': 'pallad',
			'Ir': 'irid', 'Os': 'osm', 'Ru': 'ruthen', 'Rh': 'rhod', 'Re': 'rhen', 'Tc': 'technet', 'Ge': 'german', 'Po': 'polon'
		},
		COMMON_OXIDATION_STATES: {
			'Fe': [3, 2], 'Cu': [2, 1], 'Hg': [2, 1], 'Sn': [4, 2], 'Pb': [4, 2], 'Co': [3, 2], 'Ni': [2, 3], 'Au': [3, 1],
			'Mn': [2, 3, 4, 6, 7], 'Cr': [3, 6, 2], 'V': [5, 4, 3, 2], 'Ti': [4, 3, 2], 'Pt': [4, 2], 'Pd': [4, 2], 'Ag': [1, 2],
			'Zn': [2], 'Cd': [2], 'W': [6, 5, 4, 3, 2], 'Mo': [6, 5, 4, 3, 2, 0], 'Re': [7, 6, 4, 2, -1], 'Tc': [7, 6, 4],
			'Ru': [2, 3, 4, 6, 8], 'Os': [2, 3, 4, 6, 8], 'Rh': [1, 2, 3, 4, 6], 'Ir': [1, 2, 3, 4, 6], 'Nb': [5, 4, 3],
			'Ta': [5, 4], 'Zr': [4, 3, 2], 'Sc': [3], 'Y': [3], 'La': [3], 'Al': [3], 'Ga': [3, 1], 'In': [3, 1],
			'Tl': [3, 1], 'Ge': [4, 2], 'As': [5, 3, -3], 'Sb': [5, 3, -3], 'Bi': [5, 3], 'Po': [6, 4, 2], 'S': [-2, 0, 2, 4, 6],
			'N': [-3, -2, -1, 0, 1, 2, 3, 4, 5], 'P': [-3, 1, 3, 4, 5], 'Cl': [-1, 1, 3, 5, 7], 'Br': [-1, 1, 3, 5, 7], 'I': [-1, 1, 3, 5, 7]
		},
		ROMAN_NUMERALS: {
			1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X',
			11: 'XI', 12: 'XII', 13: 'XIII', 14: 'XIV', 15: 'XV', 16: 'XVI', 17: 'XVII', 18: 'XVIII', 19: 'XIX', 20: 'XX'
		}
	};

	const KNOWN_COMPOUNDS = {
		'H2O': 'Water', 'H2O2': 'Hydrogen Peroxide', 'O3': 'Ozone', 'D2O': 'Heavy Water',
		'CO2': 'Carbon Dioxide', 'CO': 'Carbon Monoxide', 'CS2': 'Carbon Disulfide', 'COS': 'Carbonyl Sulfide',
		'NH3': 'Ammonia', 'N2H4': 'Hydrazine', 'PH3': 'Phosphine', 'AsH3': 'Arsine', 'SbH3': 'Stibine', 'BiH3': 'Bismuthine', 'B2H6': 'Diborane',
		'NO': 'Nitric Oxide', 'NO2': 'Nitrogen Dioxide', 'N2O': 'Nitrous Oxide', 'N2O3': 'Dinitrogen Trioxide', 'N2O4': 'Dinitrogen Tetroxide', 'N2O5': 'Dinitrogen Pentoxide',
		'SO2': 'Sulfur Dioxide', 'SO3': 'Sulfur Trioxide', 'H2S': 'Hydrogen Sulfide', 'SF6': 'Sulfur Hexafluoride', 'SOCl2': 'Thionyl Chloride', 'SO2Cl2': 'Sulfuryl Chloride',
		'SiO2': 'Silicon Dioxide', 'SiH4': 'Silane', 'Si2H6': 'Disilane', 'SiC': 'Silicon Carbide',
		'HCl': 'Hydrogen Chloride', 'HF': 'Hydrogen Fluoride', 'HBr': 'Hydrogen Bromide', 'HI': 'Hydrogen Iodide', 'HCN': 'Hydrogen Cyanide', 'HOCN': 'Isocyanic Acid', 'HNCO': 'Cyanic Acid',
		'H2SO4': 'Sulfuric Acid', 'HNO3': 'Nitric Acid', 'H3PO4': 'Phosphoric Acid', 'H2CO3': 'Carbonic Acid', 'HClO4': 'Perchloric Acid', 'HClO3': 'Chloric Acid', 'HIO3': 'Iodic Acid',
		'H3PO3': 'Phosphorous Acid', 'H3BO3': 'Boric Acid', 'H2SO3': 'Sulfurous Acid', 'H2CrO4': 'Chromic Acid', 'HMnO4': 'Permanganic Acid',
		'NaOH': 'Sodium Hydroxide', 'KOH': 'Potassium Hydroxide', 'Ca(OH)2': 'Calcium Hydroxide', 'Mg(OH)2': 'Magnesium Hydroxide', 'Al(OH)3': 'Aluminum Hydroxide',
		'NaCl': 'Sodium Chloride', 'KCl': 'Potassium Chloride', 'CaCl2': 'Calcium Chloride', 'MgCl2': 'Magnesium Chloride', 'FeCl3': 'Iron(III) Chloride',
		'CaCO3': 'Calcium Carbonate', 'NaHCO3': 'Sodium Bicarbonate', 'Na2CO3': 'Sodium Carbonate', 'K2CO3': 'Potassium Carbonate',
		'NaNO3': 'Sodium Nitrate', 'KNO3': 'Potassium Nitrate', 'NH4Cl': 'Ammonium Chloride', 'Na2SO4': 'Sodium Sulfate', 'CuSO4': 'Copper(II) Sulfate',
		'CH4': 'Methane', 'C2H6': 'Ethane', 'C3H8': 'Propane', 'C4H10': 'Butane', 'C5H12': 'Pentane', 'C6H14': 'Hexane', 'C7H16': 'Heptane', 'C8H18': 'Octane', 'C9H20': 'Nonane', 'C10H22': 'Decane',
		'C2H4': 'Ethene', 'C3H6': 'Propene', 'C4H8': 'Butene', 'C5H10': 'Pentene', 'C6H12': 'Hexene',
		'C2H2': 'Ethyne', 'C3H4': 'Propyne', 'C4H6': 'Butyne', 'C5H8': 'Pentyne', 'C6H10': 'Hexyne',
		'C6H6': 'Benzene', 'C7H8': 'Toluene', 'C8H10': 'Xylene', 'C6H12': 'Cyclohexane', 'C10H8': 'Naphthalene', 'C14H10': 'Anthracene',
		'CH2O': 'Formaldehyde', 'CH4O': 'Methanol', 'C2H4O': 'Acetaldehyde', 'C2H4O2': 'Acetic Acid', 'C2H6O': 'Ethanol',
		'C3H6O': 'Acetone', 'C3H8O': 'Propanol', 'C4H8O': 'Butanone', 'C4H10O': 'Butanol',
		'HCOOH': 'Formic Acid', 'CH3COOH': 'Acetic Acid', 'CH3CH2COOH': 'Propanoic Acid', 'CH3COOCH3': 'Methyl Acetate',
		'CH3OCH3': 'Dimethyl Ether', 'CH3CH2OCH2CH3': 'Diethyl Ether',
		'CH3NH2': 'Methylamine', 'C2H5NH2': 'Ethylamine', 'C6H5NH2': 'Aniline',
		'CH2Cl2': 'Dichloromethane', 'CHCl3': 'Chloroform', 'CCl4': 'Carbon Tetrachloride',
		'C6H12O6': 'Glucose', 'C12H22O11': 'Sucrose', 'C2H5SH': 'Ethanethiol', 'C6H5OH': 'Phenol',
		'CH3COONa': 'Sodium Acetate', 'C6H5COOH': 'Benzoic Acid', 'C6H5COONa': 'Sodium Benzoate',
		'C5H5N': 'Pyridine', 'C4H4O': 'Furan', 'C4H4S': 'Thiophene', 'C4H5N': 'Pyrrole'
	};

	const POLYATOMIC_IONS = {
		'H3O': { name: 'hydronium', charge: 1 }, 'NH4': { name: 'ammonium', charge: 1 },
		'CH3COO': { name: 'acetate', charge: -1 }, 'C2H3O2': { name: 'acetate', charge: -1 },
		'CN': { name: 'cyanide', charge: -1 }, 'OCN': { name: 'cyanate', charge: -1 }, 'SCN': { name: 'thiocyanate', charge: -1 },
		'CO3': { name: 'carbonate', charge: -2 }, 'HCO3': { name: 'bicarbonate', charge: -1 },
		'C2O4': { name: 'oxalate', charge: -2 }, 'HC2O4': { name: 'bioxalate', charge: -1 },
		'ClO': { name: 'hypochlorite', charge: -1 }, 'ClO2': { name: 'chlorite', charge: -1 },
		'ClO3': { name: 'chlorate', charge: -1 }, 'ClO4': { name: 'perchlorate', charge: -1 },
		'BrO': { name: 'hypobromite', charge: -1 }, 'BrO2': { name: 'bromite', charge: -1 },
		'BrO3': { name: 'bromate', charge: -1 }, 'BrO4': { name: 'perbromate', charge: -1 },
		'IO': { name: 'hypoiodite', charge: -1 }, 'IO2': { name: 'iodite', charge: -1 },
		'IO3': { name: 'iodate', charge: -1 }, 'IO4': { name: 'periodate', charge: -1 }, 'H4IO6': { name: 'periodate', charge: -1 },
		'CrO4': { name: 'chromate', charge: -2 }, 'Cr2O7': { name: 'dichromate', charge: -2 },
		'MnO4': { name: 'permanganate', charge: -1 }, 'MnO4-2': { name: 'manganate', charge: -2 },
		'NO2': { name: 'nitrite', charge: -1 }, 'NO3': { name: 'nitrate', charge: -1 },
		'OH': { name: 'hydroxide', charge: -1 }, 'O2': { name: 'peroxide', charge: -2 },
		'PO3': { name: 'phosphite', charge: -3 }, 'PO4': { name: 'phosphate', charge: -3 },
		'HPO4': { name: 'hydrogen phosphate', charge: -2 }, 'H2PO4': { name: 'dihydrogen phosphate', charge: -1 },
		'S2O3': { name: 'thiosulfate', charge: -2 }, 'S2O8': { name: 'peroxydisulfate', charge: -2 },
		'SO3': { name: 'sulfite', charge: -2 }, 'SO4': { name: 'sulfate', charge: -2 },
		'HSO3': { name: 'bisulfite', charge: -1 }, 'HSO4': { name: 'bisulfate', charge: -1 },
		'S2O7': { name: 'disulfate', charge: -2 }, 'S4O6': { name: 'tetrathionate', charge: -2 },
		'CNO': { name: 'cyanate', charge: -1 }, 'NCO': { name: 'isocyanato', charge: -1 },
		'SiO3': { name: 'silicate', charge: -2 }, 'BO3': { name: 'borate', charge: -3 }, 'B4O7': { name: 'tetraborate', charge: -2 },
		'AsO3': { name: 'arsenite', charge: -3 }, 'AsO4': { name: 'arsenate', charge: -3 },
		'SeO3': { name: 'selenite', charge: -2 }, 'SeO4': { name: 'selenate', charge: -2 },
		'TeO3': { name: 'tellurite', charge: -2 }, 'TeO4': { name: 'tellurate', charge: -2 },
		'IO5': { name: 'mesoperiodate', charge: -3 }, 'H2VO4': { name: 'vanadate', charge: -1 }, 'VO3': { name: 'metavanadate', charge: -1 },
		'MoO4': { name: 'molybdate', charge: -2 }, 'WO4': { name: 'tungstate', charge: -2 },
		'RuO4': { name: 'ruthenate', charge: -2 }, 'OsO4': { name: 'osmate', charge: -2 },
		'HCOO': { name: 'formate', charge: -1 }, 'C6H5COO': { name: 'benzoate', charge: -1 },
		'Fe(CN)6': { name: 'hexacyanoferrate(II)', charge: -4 }, 'Fe(CN)6-3': { name: 'hexacyanoferrate(III)', charge: -3 }
	};

	const getElement = (symbol) => elementsData.find(el => el.symbol === symbol);
	
	const getHillFormula = (comp) => {
		const symbols = Object.keys(comp);
		const hasC = symbols.includes('C');

		const sortFunc = (a, b) => {
			if (hasC) {
				if (a === 'C') return -1; if (b === 'C') return 1;
				if (a === 'H') return -1; if (b === 'H') return 1;
			}
			return a.localeCompare(b);
		};

		return symbols.sort(sortFunc)
			.map(symbol => `${symbol}${comp[symbol] > 1 ? comp[symbol] : ''}`)
			.join('');
	};
	
	const symbols = Object.keys(composition);
	if (symbols.length === 0) return "";
	
	const elements = symbols.map(getElement).filter(Boolean);
	if (elements.length !== symbols.length) return "Unknown elements in formula";
	
	const formula = getHillFormula(composition);
	if (KNOWN_COMPOUNDS[formula]) return KNOWN_COMPOUNDS[formula];
	
	const isOrganic = () => symbols.includes('C');
	const isAcid = () => composition['H'] > 0 && elements.length > 1 && !elements.some(el => el.category.includes('metal') && el.symbol !== 'H');
	
	const classifyElements = () => {
		const metals = elements.filter(el => el.category.includes('metal') || (el.category.includes('metalloid') && el.electronegativity < 1.9));
		const nonmetals = elements.filter(el => !metals.includes(el));
		return { metals, nonmetals };
	};

	const { metals, nonmetals } = classifyElements();
	const isIonic = () => metals.length > 0 && nonmetals.length > 0;
	
	const nameOrganic = () => {
		const c = composition['C'] || 0;
		const h = composition['H'] || 0;
		if (c === 0) return null;

		const prefix = CHEMICAL_DATA.ORGANIC_PREFIXES[c] || `polycarb`;
		if(symbols.every(s => ['C', 'H'].includes(s))) {
			if (h === 2 * c + 2) return prefix + 'ane';
			if (h === 2 * c) return prefix + 'ene (or cycloalkane)';
			if (h === 2 * c - 2) return prefix + 'yne (or diene)';
			return `Unsaturated hydrocarbon`;
		}
		
		const o = composition['O'] || 0;
		if (o > 0 && symbols.every(s => ['C', 'H', 'O'].includes(s))) {
			if (h === 2 * c + 2 && o === 1) return `${prefix}anol or ${prefix}yl ether`;
			if (h === 2 * c && o === 1) return `${prefix}anal or ${prefix}anone`;
			if (h === 2 * c && o === 2) return `${prefix}anoic acid or ester`;
		}
		return 'Organic compound derivative';
	};

	const nameIonic = () => {
		let cation, anionComp = { ...composition };
		
		if (composition['N'] >= 1 && composition['H'] >= 4) {
			const tempAnionComp = { ...composition };
			tempAnionComp['N'] -= 1;
			tempAnionComp['H'] -= 4;
			if (tempAnionComp['N'] === 0) delete tempAnionComp['N'];
			if (tempAnionComp['H'] === 0) delete tempAnionComp['H'];
			const anionFormula = getHillFormula(tempAnionComp);
			if(Object.keys(tempAnionComp).length === 0 || POLYATOMIC_IONS[anionFormula] || Object.keys(tempAnionComp).length === 1) {
				cation = { name: 'ammonium', symbol: 'NH4', count: 1, charge: 1 };
				anionComp = tempAnionComp;
			}
		}

		if (!cation) {
			if (metals.length !== 1) return null;
			const cationElement = metals[0];
			cation = { name: cationElement.name, symbol: cationElement.symbol, count: composition[cationElement.symbol] };
			delete anionComp[cation.symbol];
		}

		const anionFormula = getHillFormula(anionComp);
		const anionCount = (Object.keys(anionComp).length === 1) ? anionComp[Object.keys(anionComp)[0]] : 1;
		let anionName, totalAnionCharge;

		if (POLYATOMIC_IONS[anionFormula]) {
			anionName = POLYATOMIC_IONS[anionFormula].name;
			totalAnionCharge = POLYATOMIC_IONS[anionFormula].charge;
		} else if (Object.keys(anionComp).length === 1) {
			const anionSymbol = Object.keys(anionComp)[0];
			const anionElement = getElement(anionSymbol);
			anionName = (CHEMICAL_DATA.ELEMENT_ROOTS[anionSymbol] || anionElement.name.toLowerCase().slice(0, 4)) + 'ide';
			totalAnionCharge = (anionElement.electronegativity > 2.0 && anionElement.group) ? Math.min(-1, anionElement.group - 18) * anionCount : -1 * anionCount;
		} else {
			return null;
		}

		const cationCharge = -totalAnionCharge / cation.count;
		if (cationCharge <= 0 || !Number.isInteger(cationCharge)) return null;
		
		let cationChargeStr = '';
		const possibleStates = CHEMICAL_DATA.COMMON_OXIDATION_STATES[cation.symbol];
		if (possibleStates && possibleStates.length > 1) {
			cationChargeStr = ` (${CHEMICAL_DATA.ROMAN_NUMERALS[cationCharge] || cationCharge})`;
		}

		return `${cation.name}${cationChargeStr} ${anionName}`;
	};

	const nameAcid = () => {
		const anionComp = { ...composition };
		delete anionComp['H'];
		const anionFormula = getHillFormula(anionComp);

		if (POLYATOMIC_IONS[anionFormula]) {
			let name = POLYATOMIC_IONS[anionFormula].name;
			name = name.replace('ate', 'ic acid').replace('ite', 'ous acid');
			return name.charAt(0).toUpperCase() + name.slice(1);
		}
		
		if(Object.keys(anionComp).length === 1) {
			const anionSymbol = Object.keys(anionComp)[0];
			const anionRoot = CHEMICAL_DATA.ELEMENT_ROOTS[anionSymbol] || getElement(anionSymbol).name.toLowerCase();
			return `Hydro${anionRoot}ic acid`;
		}
		return null;
	};

	const nameBinaryCovalent = () => {
		if (elements.length !== 2) return null;

		const [el1, el2] = [...elements].sort((a, b) => (a.electronegativity || 0) - (b.electronegativity || 0));
		const count1 = composition[el1.symbol];
		const count2 = composition[el2.symbol];
		
		let prefix1 = CHEMICAL_DATA.GREEK_PREFIXES[count1] || '';
		let prefix2 = CHEMICAL_DATA.GREEK_PREFIXES[count2] || 'mono';
		
		const name1 = el1.name.toLowerCase();
		let root2 = (CHEMICAL_DATA.ELEMENT_ROOTS[el2.symbol] || el2.name.toLowerCase().slice(0, 4)) + 'ide';

		if ((prefix2.endsWith('a') || prefix2.endsWith('o')) && ['a', 'e', 'i', 'o', 'u'].includes(root2[0])) {
			prefix2 = prefix2.slice(0, -1);
		}
		if (prefix1 === 'mono') prefix1 = '';

		const result = `${prefix1}${name1} ${prefix2}${root2}`.trim();
		return result.charAt(0).toUpperCase() + result.slice(1);
	};

	const nameElemental = () => {
		const count = composition[symbols[0]];
		const prefix = CHEMICAL_DATA.GREEK_PREFIXES[count] || '';
		return `${prefix ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : ''}${elements[0].name}`;
	};

	let name;
	if (isIonic()) { name = nameIonic(); if (name) return name; }
	if (isAcid()) { name = nameAcid(); if (name) return name; }
	if (isOrganic()) { name = nameOrganic(); if (name) return name; }
	if (nonmetals.length === 2 && metals.length === 0) { name = nameBinaryCovalent(); if (name) return name; }
	if (elements.length === 1) return nameElemental();

	const elementNames = elements.map(e => e.name);
	return `Compound of ${elementNames.join(', ')}`;
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