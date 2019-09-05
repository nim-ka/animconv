function getCounter (token) {
	return token.slice(1) + "."
}

function getFirstValue (node) {
	return node.children[0].value
}

function findChildFirstValue (node, type) {
	return getFirstValue(node.children.filter((child) => child.type == type)[0])
}

function chunk (arr, size) {
	let arrs = [[]]

	for (let i = 0; i < arr.length; i ++) {
		arrs[arrs.length - 1].push(arr[i])

		if (arrs[arrs.length - 1].length == size && i != arr.length - 1) {
			arrs.push([])
		}
	}

	return arrs
}

function arrayEquals (a, b) {
	if (a.length != b.length) {
		return false
	}

	for (let i = 0; i < a.length; i ++) {
		if (a[i] != b[i]) {
			return false
		}
	}

	return true
}

function allSameElement (arr) {
	for (let i = 0; i < arr.length; i ++) {
		if (arr[i] != arr[0]) {
			return false
		}
	}

	return true
}

module.exports = {
	getCounter: getCounter,
	getFirstValue: getFirstValue,
	findChildFirstValue: findChildFirstValue,
	chunk: chunk,
	arrayEquals: arrayEquals,
	allSameElement: allSameElement
}
