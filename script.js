/* Sample table structures for understanding calls and content (dictionaries are located in the dic.js file)
const elementsData = [{ number: 1, symbol: 'H', name: 'Hydrogen', maxBonds: 1, row: 1, col: 1, color: 0xFFFFFF, radius: 0.37, atomicMass: 1.008, electronegativity: 2.20, category: 'diatomic-nonmetal' }]; 
const ELECTRON_GEOMETRIES = {2: [new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0)]};
const CHEMICAL_DATA = {
	GREEK_PREFIXES: {1: '', 2: 'di', 3: 'tri'},
	ORGANIC_PREFIXES: {1: 'meth', 2: 'eth'},
	ELEMENT_ROOTS: {'O': 'ox', 'H': 'hydr'},
	COMMON_OXIDATION_STATES: {'Fe': [3, 2], 'Cu': [2, 1]},
	ROMAN_NUMERALS: {1: 'I', 2: 'II', 3: 'III'}
};
*/

let scene, camera, renderer, controls;
let atoms = [];
let bonds = [];
let placementHelpers = [];
let atomToPlaceData = null;
let selectedAtom = null;
let atomForBonding = null;
let formulaInput;
let buildTimeout;
let currentFormulaString = null;

let isCtrlPressed = false;
let isShiftPressed = false;
let draggedAtom = null;
let longClickTimer = null;
let longClickTargetHelper = null;
const LONG_CLICK_DURATION = 400;
let touchStartX, touchStartY;
let lastTap = 0;
let lastTapTarget = null;
let isDraggingViaTouch = false;
const DOUBLE_TAP_DELAY = 300;

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

	renderer.domElement.addEventListener('touchstart', onTouchStart, { passive: false });
	renderer.domElement.addEventListener('touchmove', onTouchMove, { passive: false });
	renderer.domElement.addEventListener('touchend', onTouchEnd);
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

function handleBondCreation(targetAtom) {
	currentFormulaString = null;
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
			validateAndColorAtoms();
		}
	}
}

function onMouseDown3D(event) {
	mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
	raycaster.setFromCamera(mouse, camera);

	if (isPlacementModeActive) {
		const helperMeshes = placementHelpers.map(h => h.mesh);
		const intersects = raycaster.intersectObjects(helperMeshes, false);

		if (intersects.length > 0 && event.button === 0) {
			const targetHelper = placementHelpers.find(h => h.mesh === intersects[0].object);
			if (targetHelper) {
				longClickTargetHelper = targetHelper;
				longClickTimer = setTimeout(() => {
					if (longClickTargetHelper) {
						placeAtom(atomToPlaceData, longClickTargetHelper.targetAtom);
						cancelPlacement();
						longClickTargetHelper = null;
						longClickTimer = null;
					}
				}, LONG_CLICK_DURATION);
			}
		}
		return;
	}

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

function onTouchStart(event) {
	if (event.touches.length > 1) {
		clearTimeout(longClickTimer);
		longClickTimer = null;
		isDraggingViaTouch = false;
		controls.enabled = true;
		return;
	}

	const touch = event.touches[0];
	touchStartX = touch.clientX;
	touchStartY = touch.clientY;

	mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
	mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
	raycaster.setFromCamera(mouse, camera);

	clearTimeout(longClickTimer);

	if (isPlacementModeActive) {
		const helperMeshes = placementHelpers.map(h => h.mesh);
		const intersects = raycaster.intersectObjects(helperMeshes, false);
		if (intersects.length > 0) {
			event.preventDefault();
			const targetHelper = placementHelpers.find(h => h.mesh === intersects[0].object);
			if (targetHelper) {
				longClickTargetHelper = targetHelper;
				longClickTimer = setTimeout(() => {
					if (longClickTargetHelper) {
						placeAtom(atomToPlaceData, longClickTargetHelper.targetAtom);
						cancelPlacement();
						longClickTargetHelper = null;
						longClickTimer = null;
					}
				}, LONG_CLICK_DURATION);
			}
		}
		return;
	}

	const atomMeshes = atoms.map(a => a.mesh);
	const intersects = raycaster.intersectObjects(atomMeshes, false);
	if (intersects.length > 0) {
		event.preventDefault();
		const targetAtom = atoms.find(a => a.mesh === intersects[0].object);
		if (targetAtom) {
			isDraggingViaTouch = false;
			longClickTimer = setTimeout(() => {
				isDraggingViaTouch = true;
				draggedAtom = targetAtom;
				controls.enabled = false;
				renderer.domElement.style.cursor = 'grabbing';
				dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(dragPlane.normal), draggedAtom.position);
				if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
					dragOffset.copy(draggedAtom.position).sub(intersectionPoint);
				}
			}, LONG_CLICK_DURATION);
		}
	}
}

function onMouseMove3D(event) {
	if (longClickTimer) {
		clearTimeout(longClickTimer);
		longClickTimer = null;
		longClickTargetHelper = null;
	}

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

function onTouchMove(event) {
	if (event.touches.length > 1) {
		clearTimeout(longClickTimer);
		longClickTimer = null;
		return;
	}

	const touch = event.touches[0];
	const deltaX = Math.abs(touch.clientX - touchStartX);
	const deltaY = Math.abs(touch.clientY - touchStartY);

	if (deltaX > 5 || deltaY > 5) {
		clearTimeout(longClickTimer);
		longClickTimer = null;
		longClickTargetHelper = null;
	}

	if (isDraggingViaTouch && draggedAtom) {
		event.preventDefault();
		mouse.x = (touch.clientX / window.innerWidth) * 2 - 1;
		mouse.y = -(touch.clientY / window.innerHeight) * 2 + 1;
		raycaster.setFromCamera(mouse, camera);
		if (raycaster.ray.intersectPlane(dragPlane, intersectionPoint)) {
			const newPosition = intersectionPoint.add(dragOffset);
			draggedAtom.position.copy(newPosition);
			draggedAtom.velocity.set(0, 0, 0);
		}
	}
}

function onMouseUp3D(event) {
	if (longClickTimer) {
		clearTimeout(longClickTimer);
		longClickTimer = null;
		longClickTargetHelper = null;
	}

	if (event.button === 0 && draggedAtom) {
		draggedAtom = null;
		renderer.domElement.style.cursor = isCtrlPressed ? 'pointer' : 'auto';
	}
}

function onTouchEnd(event) {
	const wasDragging = isDraggingViaTouch;
	clearTimeout(longClickTimer);
	longClickTimer = null;
	longClickTargetHelper = null;
	isDraggingViaTouch = false;

	if (wasDragging) {
		draggedAtom = null;
		controls.enabled = true;
		renderer.domElement.style.cursor = 'auto';
		return;
	}
	
	controls.enabled = true;

	mouse.x = (touchStartX / window.innerWidth) * 2 - 1;
	mouse.y = -(touchStartY / window.innerHeight) * 2 + 1;
	raycaster.setFromCamera(mouse, camera);

	if (isPlacementModeActive) {
		const helperMeshes = placementHelpers.map(h => h.mesh);
		const intersects = raycaster.intersectObjects(helperMeshes, false);
		if (intersects.length > 0) {
			const targetHelper = placementHelpers.find(h => h.mesh === intersects[0].object);
			if (targetHelper) {
				selectedHelperIndex = placementHelpers.indexOf(targetHelper);
				highlightSelectedHelper();
			}
		}
		return;
	}

	const atomMeshes = atoms.map(a => a.mesh);
	const intersects = raycaster.intersectObjects(atomMeshes, false);

	if (intersects.length > 0) {
		const targetAtom = atoms.find(a => a.mesh === intersects[0].object);
		if (targetAtom) {
			const currentTime = Date.now();
			if (currentTime - lastTap < DOUBLE_TAP_DELAY && lastTapTarget === targetAtom) {
				deleteAtom(targetAtom);
				lastTap = 0;
				lastTapTarget = null;
			} else {
				handleBondCreation(targetAtom);
				lastTap = currentTime;
				lastTapTarget = targetAtom;
			}
		}
	} else {
		if (atomForBonding) {
			atomForBonding.mesh.material.emissive.setHex(0x000000);
			atomForBonding = null;
		}
		deselectAllAtoms();
		lastTapTarget = null;
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
	currentFormulaString = null;
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
		validateAndColorAtoms();
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

	formulaInput = document.getElementById('formula-input');
	formulaInput.addEventListener('input', onFormulaInputChange);

	const resizeHandle = document.getElementById('resize-handle');
	let isResizing = false;
	let currentScale = 0.8;
	let initialUnscaledWidth;
	let initialMouseX;

	uiContainer.style.transform = `scale(${currentScale})`;

	const startResize = (e) => {
		e.preventDefault();
		e.stopPropagation();

		isResizing = true;
		initialUnscaledWidth = uiContainer.offsetWidth;
		initialMouseX = e.clientX;

		document.body.style.cursor = 'se-resize';
		window.addEventListener('mousemove', doResize);
		window.addEventListener('mouseup', stopResize);
	};

	const doResize = (e) => {
		if (!isResizing) return;

		const mouseDeltaX = e.clientX - initialMouseX;
		const newScaledWidth = (initialUnscaledWidth * currentScale) + mouseDeltaX;
		let newScale = newScaledWidth / initialUnscaledWidth;

		newScale = Math.max(0.4, Math.min(newScale, 1.5));

		uiContainer.style.transform = `scale(${newScale})`;
	};

	const stopResize = () => {
		if (!isResizing) return;
		isResizing = false;

		const transformValue = uiContainer.style.transform;
		const scaleMatch = transformValue.match(/scale\(([^)]+)\)/);
		if (scaleMatch && scaleMatch[1]) {
			currentScale = parseFloat(scaleMatch[1]);
		}

		document.body.style.cursor = 'auto';
		window.removeEventListener('mousemove', doResize);
		window.removeEventListener('mouseup', stopResize);
	};

	resizeHandle.addEventListener('mousedown', startResize);

	let isDragging = false;
	let offsetX, offsetY;
	const onMouseDown = (e) => {
		if (e.target.closest('button') || e.target.id === 'resize-handle' || e.target.id === 'formula-input') return;
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
	const valence = atom.data.valenceElectrons || (atom.data.group ? (atom.data.group > 12 ? atom.data.group - 10 : atom.data.group) : 0);
	return Math.max(0, Math.floor((valence - bondOrderSum) / 2));
}

function getStericNumber(atom) {
	const lonePairs = getLonePairs(atom);
	return atom.bonds.length + lonePairs;
}

function getFormalCharge(atom) {
	const valence = atom.data.valenceElectrons || (atom.data.group ? (atom.data.group > 12 ? atom.data.group - 10 : atom.data.group) : 0);
	if (!valence) return 0;

	const lonePairElectrons = getLonePairs(atom) * 2;
	const bondingElectronsAssigned = getBondOrderSum(atom);

	return valence - lonePairElectrons - bondingElectronsAssigned;
}

function validateAndColorAtoms() {
	atoms.forEach(atom => {
		atom.mesh.material.emissive.setHex(0x000000);

		const formalCharge = getFormalCharge(atom);
		const bondOrderSum = getBondOrderSum(atom);
		const lonePairs = getLonePairs(atom);
		const totalValenceShellElectrons = (bondOrderSum * 2) + (lonePairs * 2);

		let hasError = false;

		if (bondOrderSum > atom.data.maxBonds) {
			hasError = true;
		}

		if (atom.data.row === 2 && atom.data.number > 2 && totalValenceShellElectrons > 8) {
			hasError = true;
		}
		if (atom.data.number === 1 && totalValenceShellElectrons > 2) {
			hasError = true;
		}

		if (Math.abs(formalCharge) > 1) {
			hasError = true;
		}

		if (atom.data.electronegativity >= 3.4 && formalCharge > 0) {
			hasError = true;
		}
		
		if (atom.data.electronegativity < 1.2 && formalCharge < 0) {
			hasError = true;
		}

		if (hasError) {
			atom.mesh.material.emissive.setHex(0xcc0000);
		}
	});

	if (selectedAtom) {
		selectedAtom.mesh.material.emissive.setHex(0x555555);
	}
	if (atomForBonding) {
		atomForBonding.mesh.material.emissive.setHex(0x005588);
	}
}

function updatePeriodicTableState() {
	const moleculeHasOpenSlots = atoms.some(atom => getBondOrderSum(atom) < atom.data.maxBonds);
	const elementsInTable = document.querySelectorAll('.element');

	elementsInTable.forEach(elDiv => {
		const symbol = elDiv.dataset.symbol;
		const elData = elementsData.find(e => e.symbol === symbol);
		if (!elData || (elData.maxBonds === 0 && atoms.length > 0)) {
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
	if (isPlacementModeActive && atomToPlaceData && atomToPlaceData.symbol === symbol) {
		const helper = placementHelpers[selectedHelperIndex];
		if (helper) {
			placeAtom(atomToPlaceData, helper.targetAtom);
		}
		cancelPlacement();
		return;
	}

	if (atomToPlaceData || isPlacementModeActive) return;
	currentFormulaString = null;
	if (formulaInput.value) {
		formulaInput.value = '';
	}

	const data = elementsData.find(e => e.symbol === symbol);
	if (!data) return;

	if (atoms.length === 0) {
		addAtom(data);
		updatePeriodicTableState();
		validateAndColorAtoms();
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
	return newAtom;
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
	const idealDirections = ELECTRON_GEOMETRIES[futureStericNumber] || ELECTRON_GEOMETRIES[ligands.length + 1] || ELECTRON_GEOMETRIES[4] || [new THREE.Vector3(1,0,0)];

	let rotation = new THREE.Quaternion();
	if (ligands.length > 0 && idealDirections.length > 1) {
		const actualDir = new THREE.Vector3().subVectors(ligands[0].position, targetAtom.position).normalize();
		if (actualDir.lengthSq() > 0.1) {
			rotation.setFromUnitVectors(idealDirections[0], actualDir);
		}
	}
	
	const usedDirections = ligands.map(l => new THREE.Vector3().subVectors(l.position, targetAtom.position).normalize());
	const rotatedIdeals = idealDirections.map(d => d.clone().applyQuaternion(rotation));

	let bestNewDirection = null;
	let maxMinAngle = -1;

	rotatedIdeals.forEach(idealDir => {
		let minAngleToUsed = Math.PI * 2;
		if (usedDirections.length > 0) {
			usedDirections.forEach(usedDir => {
				minAngleToUsed = Math.min(minAngleToUsed, idealDir.angleTo(usedDir));
			});
		} else {
			minAngleToUsed = Math.PI;
		}

		if (minAngleToUsed > maxMinAngle) {
			maxMinAngle = minAngleToUsed;
			bestNewDirection = idealDir;
		}
	});

	if (!bestNewDirection) {
		const usedIndices = new Set();
		usedDirections.forEach(usedDir => {
			let closestIndex = -1;
			let minAngle = Math.PI * 2;
			rotatedIdeals.forEach((ideal, i) => {
				const angle = ideal.angleTo(usedDir);
				if (angle < minAngle) {
					minAngle = angle;
					closestIndex = i;
				}
			});
			if (closestIndex !== -1) usedIndices.add(closestIndex);
		});
		for (let i = 0; i < rotatedIdeals.length; i++) {
			if (!usedIndices.has(i)) {
				bestNewDirection = rotatedIdeals[i];
				break;
			}
		}
	}
	
	bestNewDirection = bestNewDirection || new THREE.Vector3(1, 0, 0);
	const idealLength = getIdealBondLength(targetAtom, newAtom, 1);
	return new THREE.Vector3().copy(targetAtom.position).add(bestNewDirection.normalize().multiplyScalar(idealLength));
}

function createBond(atom1, atom2) {
	if (getBondOrderSum(atom1) >= atom1.data.maxBonds || getBondOrderSum(atom2) >= atom2.data.maxBonds) {
		return;
	}
	const existingBond = bonds.find(b => (b.atom1 === atom1 && b.atom2 === atom2) || (b.atom1 === atom2 && b.atom2 === atom1));
	if (!existingBond) {
		const bond = { atom1, atom2, order: 1, meshes: [] };
		bonds.push(bond);
		atom1.bonds.push(bond);
		atom2.bonds.push(bond);
		updateBondMeshes();
		validateAndColorAtoms();
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

function resetSimulation(isInternalCall = false) {
	cancelPlacement();
	atoms.forEach(atom => scene.remove(atom.mesh));
	bonds.forEach(bond => bond.meshes.forEach(mesh => scene.remove(mesh)));
	atoms = [];
	bonds = [];
	selectedAtom = null;
	draggedAtom = null;
	atomForBonding = null;

	if (!isInternalCall) {
		currentFormulaString = null;
		if (formulaInput) {
			formulaInput.value = '';
			formulaInput.classList.remove('error');
		}
	}

	updatePeriodicTableState();
	updateMoleculeInfo();
}

function updateMoleculeInfo() {
	if (atoms.length === 0) {
		moleculeInfoDiv.classList.remove('visible');
		return;
	}

	if (currentFormulaString) {
		moleculeFormulaSpan.innerHTML = currentFormulaString.replace(/(\d+)/g, '<sub>$1</sub>');
	} else {
		const composition = atoms.reduce((acc, atom) => {
			const symbol = atom.data.symbol;
			acc[symbol] = (acc[symbol] || 0) + 1;
			return acc;
		}, {});
		moleculeFormulaSpan.innerHTML = generateFormula(composition);
	}
	
	const nameComposition = atoms.reduce((acc, atom) => {
		const symbol = atom.data.symbol;
		acc[symbol] = (acc[symbol] || 0) + 1;
		return acc;
	}, {});

	moleculeNameSpan.textContent = generateName(nameComposition);
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

function onFormulaInputChange(event) {
	const formula = event.target.value;
	formulaInput.classList.remove('error');

	clearTimeout(buildTimeout);
	buildTimeout = setTimeout(() => {
		currentFormulaString = formula.trim();
		if (currentFormulaString === '') {
			resetSimulation();
			return;
		}

		const structure = parseFormula(currentFormulaString);
		if (structure) {
			buildMoleculeFromStructure(structure);
		} else {
			formulaInput.classList.add('error');
		}
	}, 500);
}

function parseFormula(formula) {
	const tokens = formula.replace(/\s+/g, '').match(/([A-Z][a-z]?\d*|[()\[\]{}]|\d+)/g);
	if (!tokens) return null;

	let balance = 0;
	for (const token of tokens) {
		if ('([{'.includes(token)) balance++;
		if (')]}'.includes(token)) balance--;
	}
	if (balance !== 0) return null;

	function parseTokens(tokenStream) {
		const structure = [];
		let currentGroup = { atoms: {}, children: [] };

		while (tokenStream.length > 0) {
			const token = tokenStream.shift();

			if (token.match(/^[A-Z][a-z]?\d*$/)) {
				const match = token.match(/([A-Z][a-z]?)(\d*)/);
				const symbol = match[1];
				const count = match[2] ? parseInt(match[2], 10) : 1;
				if (!elementsData.some(el => el.symbol === symbol)) throw new Error('Invalid element');
				currentGroup.atoms[symbol] = (currentGroup.atoms[symbol] || 0) + count;
			} else if ('([{'.includes(token)) {
				if (Object.keys(currentGroup.atoms).length > 0) {
					structure.push(currentGroup);
					currentGroup = { atoms: {}, children: [] };
				}
				const subStructure = parseTokens(tokenStream);
				let repeat = 1;
				if (tokenStream.length > 0 && tokenStream[0].match(/^\d+$/)) {
					repeat = parseInt(tokenStream.shift(), 10);
				}
				for (let i = 0; i < repeat; i++) {
					currentGroup.children.push(subStructure);
				}
			} else if (')]}'.includes(token)) {
				break;
			} else {
				throw new Error('Invalid token');
			}
		}
		if (Object.keys(currentGroup.atoms).length > 0 || currentGroup.children.length > 0) {
			structure.push(currentGroup);
		}
		return structure;
	}

	try {
		const result = parseTokens([...tokens]);
		return result.length > 0 ? [result] : null;
	} catch (e) {
		return null;
	}
}

function ensureConnectivity() {
	if (atoms.length < 2) return;

	const findComponents = () => {
		const visited = new Set();
		const components = [];
		for (const startAtom of atoms) {
			if (!visited.has(startAtom)) {
				const component = new Set();
				const queue = [startAtom];
				visited.add(startAtom);
				component.add(startAtom);
				while (queue.length > 0) {
					const current = queue.shift();
					current.bonds.forEach(bond => {
						const neighbor = bond.atom1 === current ? bond.atom2 : bond.atom1;
						if (!visited.has(neighbor)) {
							visited.add(neighbor);
							component.add(neighbor);
							queue.push(neighbor);
						}
					});
				}
				components.push(Array.from(component));
			}
		}
		return components;
	};
	
	let components = findComponents();

	while (components.length > 1) {
		components.sort((a, b) => b.length - a.length);
		const mainComponent = components[0];
		const fragment = components[1];

		const findAttachPoint = (comp) => comp
			.filter(a => getBondOrderSum(a) < a.data.maxBonds)
			.sort((a, b) => (a.data.maxBonds - getBondOrderSum(a)) - (b.data.maxBonds - getBondOrderSum(b)))
			.pop();

		const attachFrom = findAttachPoint(mainComponent);
		const attachTo = findAttachPoint(fragment);

		if (attachFrom && attachTo) {
			const idealPosition = getNewAtomPosition(attachFrom, attachTo);
			const translation = new THREE.Vector3().subVectors(idealPosition, attachTo.position);
			fragment.forEach(atom => {
				atom.position.add(translation);
				atom.mesh.position.copy(atom.position);
			});
			createBond(attachFrom, attachTo);
		} else {
			break;
		}
		components = findComponents();
	}
}

function buildMoleculeFromStructure(structure) {
	resetSimulation(true);
	if (!structure || structure.length === 0) {
		updateMoleculeInfo();
		return;
	}

	buildRecursive(structure[0]);

	saturateWithMultipleBonds();
	ensureConnectivity();

	atoms.forEach(updateAtomGeometry);
	setTimeout(() => {
		atoms.forEach(centerAtom => {
			updateAtomGeometry(centerAtom);
		});
		updatePeriodicTableState();
		updateMoleculeInfo();
		validateAndColorAtoms();
	}, 100);
}

function buildRecursive(nodes, attachToAtom = null) {
	let lastAtom = attachToAtom;
	const allNewAtomsInChain = [];

	for (const node of nodes) {
		const groupAtomsComp = node.atoms;
		const formula = generatePlainTextFormula(groupAtomsComp);

		let builtGroup;
		if (formula === 'C6H5') {
			builtGroup = buildPhenylGroup();
		} else {
			builtGroup = buildGenericGroup(groupAtomsComp);
		}
		
		allNewAtomsInChain.push(...builtGroup.atoms);

		if (lastAtom && builtGroup.attachmentPoint) {
			const idealPosition = getNewAtomPosition(lastAtom, builtGroup.attachmentPoint);
			const translation = idealPosition.clone().sub(builtGroup.attachmentPoint.position);

			builtGroup.atoms.forEach(atom => {
				atom.position.add(translation);
				atom.mesh.position.copy(atom.position);
			});

			createBond(lastAtom, builtGroup.attachmentPoint);
		}
		
		lastAtom = builtGroup.chainEnd || builtGroup.attachmentPoint;

		if (node.children && node.children.length > 0 && builtGroup.atoms.length > 0) {
			 const parentAtomsWithOpenSlots = builtGroup.atoms
				.filter(a => a.data.symbol !== 'H' && getBondOrderSum(a) < a.data.maxBonds)
				.sort((a, b) => (getBondOrderSum(b)) - (getBondOrderSum(a)));

			 let parentAtomIndex = 0;
			 for (const childNodeList of node.children) {
				 if (parentAtomsWithOpenSlots.length > 0) {
					 const parentForChild = parentAtomsWithOpenSlots[parentAtomIndex % parentAtomsWithOpenSlots.length];
					 const childAtoms = buildRecursive(childNodeList, parentForChild);
					 allNewAtomsInChain.push(...childAtoms);
					 parentAtomIndex++;
				 }
			 }
		}
	}
	return allNewAtomsInChain;
}

function buildPhenylGroup() {
	const carbons = [];
	const newAtoms = [];
	const radius = 1.4; 
	const carbonData = elementsData.find(e => e.symbol === 'C');

	for (let i = 0; i < 6; i++) {
		const angle = (i / 6) * 2 * Math.PI;
		const x = radius * Math.cos(angle);
		const y = radius * Math.sin(angle);
		const carbonAtom = addAtom(carbonData, new THREE.Vector3(x, y, 0));
		carbons.push(carbonAtom);
		newAtoms.push(carbonAtom);
	}

	for (let i = 0; i < 6; i++) {
		createBond(carbons[i], carbons[(i + 1) % 6]);
	}

	const hydrogenData = elementsData.find(e => e.symbol === 'H');
	for (let i = 1; i < 6; i++) {
		const hAtom = placeAtom(hydrogenData, carbons[i]);
		newAtoms.push(hAtom);
	}
	
	const attachmentPoint = carbons[0];
	return { atoms: newAtoms, attachmentPoint: attachmentPoint, chainEnd: attachmentPoint };
}

function buildGenericGroup(composition) {
	const groupComposition = { ...composition };
	const atomsToCreate = [];
	const heavyAtomSymbols = Object.keys(groupComposition).filter(s => s !== 'H');
	let hydrogenCount = groupComposition['H'] || 0;
	delete groupComposition['H'];

	heavyAtomSymbols.forEach(symbol => {
		for (let i = 0; i < groupComposition[symbol]; i++) {
			atomsToCreate.push(elementsData.find(e => e.symbol === symbol));
		}
	});

	atomsToCreate.sort((a, b) => b.maxBonds - a.maxBonds || a.electronegativity - b.electronegativity);
	
	if (atomsToCreate.length === 0 && hydrogenCount > 0) {
		const hData = elementsData.find(e => e.symbol === 'H');
		if (hydrogenCount >= 1) {
			const h1 = addAtom(hData);
			if (hydrogenCount === 2) {
				placeAtom(hData, h1);
			}
			return { atoms: atoms.slice(-hydrogenCount), attachmentPoint: h1, chainEnd: h1 };
		}
		return { atoms: [], attachmentPoint: null, chainEnd: null };
	}

	const newAtoms = [];
	let centralAtom = null;
	let lastInChain = null;

	if (atomsToCreate.length > 0) {
		const firstAtom = addAtom(atomsToCreate[0], new THREE.Vector3(0,0,0));
		newAtoms.push(firstAtom);
		centralAtom = firstAtom;
		lastInChain = firstAtom;

		for (let i = 1; i < atomsToCreate.length; i++) {
			const isChain = atomsToCreate[0].symbol === 'C' && atomsToCreate[i].symbol === 'C';
			const target = isChain ? lastInChain : centralAtom;
			const newAtom = placeAtom(atomsToCreate[i], target);
			newAtoms.push(newAtom);
			if (isChain) {
				lastInChain = newAtom;
			}
		}
	} else {
		return { atoms: [], attachmentPoint: null, chainEnd: null };
	}
	
	const hData = elementsData.find(e => e.symbol === 'H');
	if (hData && hydrogenCount > 0) {
		let placedHydrogens = 0;
		let attempts = 0;
		while (placedHydrogens < hydrogenCount && attempts < hydrogenCount * 2) {
			attempts++;
			const potentialTargets = newAtoms
				.filter(a => getBondOrderSum(a) < a.data.maxBonds)
				.sort((a, b) => (a.data.maxBonds - getBondOrderSum(a)) - (b.data.maxBonds - getBondOrderSum(b)));
			
			if (potentialTargets.length === 0) break;
			const target = potentialTargets[potentialTargets.length-1];
			
			const newH = placeAtom(hData, target);
			newAtoms.push(newH);
			placedHydrogens++;
		}
	}
	
	const potentialAttachments = newAtoms.filter(a => a.data.symbol !== 'H');
	const attachmentPoint = potentialAttachments.find(a => getBondOrderSum(a) < a.data.maxBonds) || centralAtom;
	const chainEnd = potentialAttachments.find(a => a.bonds.length === 1) || lastInChain;

	return { atoms: newAtoms, attachmentPoint, chainEnd };
}

function saturateWithMultipleBonds() {
	let changed = true;
	let attempts = 0;
	while (changed && attempts < 10) {
		changed = false;
		atoms.forEach(atom => {
			while(getBondOrderSum(atom) < atom.data.maxBonds){
				const neededBonds = atom.data.maxBonds - getBondOrderSum(atom);
				if (neededBonds <= 0) break;

				let bestNeighbor = null;
				let maxNeighborNeeds = 0;

				for (const bond of atom.bonds) {
					if (bond.order >= 3) continue;
					const neighbor = bond.atom1 === atom ? bond.atom2 : bond.atom1;
					const neighborNeededBonds = neighbor.data.maxBonds - getBondOrderSum(neighbor);
					if (neighborNeededBonds > maxNeighborNeeds) {
						maxNeighborNeeds = neighborNeededBonds;
						bestNeighbor = neighbor;
					}
				}

				if(bestNeighbor){
					incrementBondOrder(atom, bestNeighbor);
					changed = true;
				} else {
					break; 
				}
			}
		});
		attempts++;
	}
}

function generatePlainTextFormula(composition) {
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
		return count > 1 ? `${symbol}${count}` : symbol;
	}).join('');
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