const elementsData = [
	{ number: 1, symbol: 'H', maxBonds: 1, row: 1, col: 1, color: 0xFFFFFF, radius: 0.35 },
	{ number: 2, symbol: 'He', maxBonds: 0, row: 1, col: 18, color: 0xD4BFFF, radius: 0.31 },
	{ number: 3, symbol: 'Li', maxBonds: 1, row: 2, col: 1, color: 0xB5FF00, radius: 1.45 },
	{ number: 4, symbol: 'Be', maxBonds: 2, row: 2, col: 2, color: 0x82D99C, radius: 1.05 },
	{ number: 5, symbol: 'B', maxBonds: 3, row: 2, col: 13, color: 0xFFC780, radius: 0.85 },
	{ number: 6, symbol: 'C', maxBonds: 4, row: 2, col: 14, color: 0x909090, radius: 0.70 },
	{ number: 7, symbol: 'N', maxBonds: 3, row: 2, col: 15, color: 0x3050F8, radius: 0.65 },
	{ number: 8, symbol: 'O', maxBonds: 2, row: 2, col: 16, color: 0xFF0D0D, radius: 0.60 },
	{ number: 9, symbol: 'F', maxBonds: 1, row: 2, col: 17, color: 0x90E050, radius: 0.50 },
	{ number: 10, symbol: 'Ne', maxBonds: 0, row: 2, col: 18, color: 0x9E7AFF, radius: 0.38 },
	{ number: 11, symbol: 'Na', maxBonds: 1, row: 3, col: 1, color: 0xAB5CF2, radius: 1.80 },
	{ number: 12, symbol: 'Mg', maxBonds: 2, row: 3, col: 2, color: 0x8AFF00, radius: 1.50 },
	{ number: 13, symbol: 'Al', maxBonds: 3, row: 3, col: 13, color: 0xBFA6A6, radius: 1.25 },
	{ number: 14, symbol: 'Si', maxBonds: 4, row: 3, col: 14, color: 0xF0C8A0, radius: 1.10 },
	{ number: 15, symbol: 'P', maxBonds: 3, row: 3, col: 15, color: 0xFF8000, radius: 1.00 },
	{ number: 16, symbol: 'S', maxBonds: 2, row: 3, col: 16, color: 0xFFFF30, radius: 1.00 },
	{ number: 17, symbol: 'Cl', maxBonds: 1, row: 3, col: 17, color: 0x1FF01F, radius: 1.00 },
	{ number: 18, symbol: 'Ar', maxBonds: 0, row: 3, col: 18, color: 0x80D1F5, radius: 0.71 },
	{ number: 19, symbol: 'K', maxBonds: 1, row: 4, col: 1, color: 0x8F40D4, radius: 2.20 },
	{ number: 20, symbol: 'Ca', maxBonds: 2, row: 4, col: 2, color: 0x3DFF00, radius: 1.80 },
	{ number: 21, symbol: 'Sc', maxBonds: 3, row: 4, col: 3, color: 0xE6E6E6, radius: 1.60 },
	{ number: 22, symbol: 'Ti', maxBonds: 4, row: 4, col: 4, color: 0xBFC2C7, radius: 1.40 },
	{ number: 23, symbol: 'V', maxBonds: 5, row: 4, col: 5, color: 0xA6A6AB, radius: 1.35 },
	{ number: 24, symbol: 'Cr', maxBonds: 6, row: 4, col: 6, color: 0x8A99C7, radius: 1.40 },
	{ number: 25, symbol: 'Mn', maxBonds: 7, row: 4, col: 7, color: 0x9C7AC7, radius: 1.40 },
	{ number: 26, symbol: 'Fe', maxBonds: 3, row: 4, col: 8, color: 0xE06633, radius: 1.40 },
];

let scene, camera, renderer, controls;
let atoms = [];
let bonds = [];
let placementHelpers = [];
let atomToPlaceData = null;
let selectedAtom = null;

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
	if (event.key === 'Control' && !isCtrlPressed) {
		isCtrlPressed = true;
		controls.enabled = false;
		renderer.domElement.style.cursor = 'pointer';
	}
	if (event.key === 'Escape') {
		if (atomToPlaceData) {
			cancelPlacement();
		}
		deselectAllAtoms();
	}
}

function onKeyUp(event) {
	if (event.key === 'Control') {
		isCtrlPressed = false;
		controls.enabled = !atomToPlaceData;
		renderer.domElement.style.cursor = 'auto';
		if (draggedAtom) {
			draggedAtom = null;
		}
	}
}

function onMouseDown3D(event) {
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	raycaster.setFromCamera(mouse, camera);

	if (atomToPlaceData) {
		const intersects = raycaster.intersectObjects(placementHelpers.map(h => h.mesh));
		if (intersects.length > 0) {
			const helper = placementHelpers.find(h => h.mesh === intersects[0].object);
			if (helper) {
				placeAtom(atomToPlaceData, helper.targetAtom);
			}
		}
		cancelPlacement();
		return;
	}

	const atomMeshes = atoms.map(a => a.mesh);
	const intersects = raycaster.intersectObjects(atomMeshes, false);

	if (intersects.length > 0) {
		const targetAtom = atoms.find(a => a.mesh === intersects[0].object);
		if (!targetAtom) return;

		if (isCtrlPressed) {
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
	const bondsToRemove = bonds.filter(b => b.atom1 === atomToDelete || b.atom2 === atomToDelete);
	bondsToRemove.forEach(bond => {
		bond.meshes.forEach(m => scene.remove(m));
		const otherAtom = bond.atom1 === atomToDelete ? bond.atom2 : bond.atom1;
		otherAtom.bonds = otherAtom.bonds.filter(b => b !== bond);
		bonds = bonds.filter(b => b !== bond);
	});
	scene.remove(atomToDelete.mesh);
	atoms = atoms.filter(a => a !== atomToDelete);
	if (atoms.length === 0) {
		resetSimulation();
	} else {
		updatePeriodicTableState();
		updateAllBondsValence();
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
		div.innerHTML = `<span class="number">${el.number}</span>${el.symbol}`;
		div.dataset.symbol = el.symbol;
		div.addEventListener('click', () => prepareToAddAtom(el.symbol));
		table.appendChild(div);
	});
}

function prepareToAddAtom(symbol) {
	if (atomToPlaceData) return;
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
		createPlacementHelpers(possibleTargets, data);
	}
}

function createPlacementHelpers(targetAtoms, newData) {
	cancelPlacement();
	controls.enabled = false;
	const helperMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.6 });
	const centerOfMass = new THREE.Vector3();
	atoms.forEach(a => centerOfMass.add(a.position));
	centerOfMass.divideScalar(atoms.length);

	targetAtoms.forEach(target => {
		const helperGeometry = new THREE.SphereGeometry(newData.radius * 0.6, 16, 16);
		const mesh = new THREE.Mesh(helperGeometry, helperMaterial);

		let direction = new THREE.Vector3().subVectors(target.position, centerOfMass).normalize();
		if (direction.lengthSq() < 0.1) {
			direction.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
		}
		const distance = target.data.radius + newData.radius;
		mesh.position.copy(target.position).add(direction.multiplyScalar(distance * 0.8));

		const helper = { mesh, targetAtom: target };
		placementHelpers.push(helper);
		scene.add(mesh);
	});
}

function cancelPlacement() {
	placementHelpers.forEach(h => scene.remove(h.mesh));
	placementHelpers = [];
	atomToPlaceData = null;
	controls.enabled = !isCtrlPressed;
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
	const centerOfMass = new THREE.Vector3();
	atoms.forEach(a => centerOfMass.add(a.position));
	centerOfMass.divideScalar(atoms.length);

	let direction = new THREE.Vector3().subVectors(targetAtom.position, centerOfMass).normalize();
	if (direction.lengthSq() < 0.1) {
		direction.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
	}
	const distance = targetAtom.data.radius + newData.radius;
	const newPosition = new THREE.Vector3().copy(targetAtom.position).add(direction.multiplyScalar(distance * 1.2));
	const newAtom = addAtom(newData, newPosition);
	createBond(newAtom, targetAtom);
	updateAllBondsValence();
	updatePeriodicTableState();
}

function createBond(atom1, atom2) {
	const existingBond = bonds.find(b =>
		(b.atom1 === atom1 && b.atom2 === atom2) || (b.atom1 === atom2 && b.atom2 === atom1)
	);
	if (existingBond) {
		if (getCurrentValence(atom1) < atom1.data.maxBonds && getCurrentValence(atom2) < atom2.data.maxBonds) {
			existingBond.order++;
		}
	} else {
		const bond = { atom1, atom2, order: 1, meshes: [] };
		bonds.push(bond);
		atom1.bonds.push(bond);
		atom2.bonds.push(bond);
	}
	updateBondMeshes();
}

function updateAllBondsValence() {
	let changed;
	do {
		changed = false;
		bonds.forEach(bond => {
			const { atom1, atom2 } = bond;
			while (getCurrentValence(atom1) > atom1.data.maxBonds || getCurrentValence(atom2) > atom2.data.maxBonds) {
				if (bond.order > 1) {
					bond.order--;
					changed = true;
				} else {
					break;
				}
			}
		});
	} while (changed);

	do {
		changed = false;
		bonds.forEach(bond => {
			const { atom1, atom2 } = bond;
			if (getCurrentValence(atom1) < atom1.data.maxBonds && getCurrentValence(atom2) < atom2.data.maxBonds) {
				bond.order++;
				changed = true;
			}
		});
		if(changed) updateAllBondsValence();
	} while (changed);
	updateBondMeshes();
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
		const idealLength = atom1.data.radius + atom2.data.radius - (order - 1) * 0.15;
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

	if (placementHelpers.length > 0) {
		const pulse = Math.sin(elapsedTime * 8) * 0.1 + 1.0;
		placementHelpers.forEach(h => h.mesh.scale.set(pulse, pulse, pulse));
	}

	if (atoms.length > 0) {
		if (draggedAtom) draggedAtom.mesh.position.copy(draggedAtom.position);
		updatePhysics(deltaTime);
		updateBondMeshes();
	}

	controls.update();
	renderer.render(scene, camera);
}

init();