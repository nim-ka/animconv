const getArgs = require("./args.js")
const parseAnimFile = require("./parse.js")
const error = require("./error.js")
const fs = require("fs")

let args = getArgs(process.argv.slice(2), {
	"--help": { len: 0, short: "-h" },
	"--decimal": { len: 0, short: "-d" },
	"--output": { len: 1, short: "-o" }
})

if (process.argv.length == 2 || args["-h"] || args["--help"]) {
	console.log([
		`animconv: SM64 Decomp ANIMation CONVerter`,
		``,
		`Usage: node main.js [options] [filename]`,
		`All options are unordered (including filename).`,
		`-----`,
		`OPTIONS:`,
		`\t-d / --decimal:`,
		`\t\tOutputs values in decimal instead of hex.`,
		`\t-h / --help:`,
		`\t\tDisplays this help menu.`,
		`\t-o <outfile> / --output <outfile>:`,
		`\t\tOutputs to outfile.`
	].join`\n`)
} else {
	let filename = args.identifiers[0].value

	if (!filename) {
		error(`No filename found`)
	}

	let animFile = parseAnimFile(filename)

	if (!animFile) {
		error(`Could not open file ${filename}. (Did you pass one too many arguments to ${args.identifiers[0].lastOption}?)`)
	}

	if (animFile.type != "object") {
		error(`Animation file data is non-supported type ${animFile.type}; try wrapping with .object`)
	}

	let output = processObject(animFile)

	if (args["--output"]) {
		fs.writeFile(args["--output"][0], output + "\n", () => console.log("Done!"));
	} else {
		console.log(output)
	}
}

function getFirstValue (node) {
	return node.children[0].value
}

function findChildFirstValue (node, type) {
	return getFirstValue(node.children.filter((child) => child.type == type)[0])
}

function paddedHex (num) {
	if (args["-d"] || args["--decimal"]) {
		return num.toString()
	}

	num = num.toString(16)

	let neg = false

	if (num[0] == "-") {
		neg = true
	}

	return `0x${"-".repeat(neg)}${"0".repeat(4 - num.length)}${num.toUpperCase()}`
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

function processObject (object) {
	let objectName = getFirstValue(object)
	let parts = object.children.slice(1)

	let animValuesName = `${objectName}_anim_values`
	let animIndexName = `${objectName}_anim_index`
	let animName = `${objectName}_anim`

	let animValues = []
	let animIndex = []
	let anim = [
		`${animName}:`,
		`    .hword ${paddedHex(0)} # flags`,
		`    .hword ${paddedHex(0)} # unk02`,
		`    .hword ${paddedHex(0)} # starting frame`
	]

	for (let part of parts) {
		let partName = getFirstValue(part)

		let frames = part.children.slice(1)

		let loopStart = 0
		let loopEnd = frames.length

		for (let i = 0; i < frames.length; i ++) {
			if (frames[i].type != "frame") {
				error(`Expected frame, got node of type ${frames[i].type}`)
			}

			if (frames[i].children[0].type == "loop") {
				if (i != frames.length - 1) {
					error(`Loop end point at frame ${i}, but found more frames after`)
				}

				loopStart = Number(frames[i].children[0].children[0].value)
				loopEnd = Number(i)

				frames = frames.slice(0, frames.length - 1)
			}
		}

		anim.push(`    .hword ${paddedHex(loopStart)} # loop start`)
		anim.push(`    .hword ${paddedHex(loopEnd)} # loop end`)
		anim.push(`    .hword ${paddedHex(0)} # unused0A`)
		anim.push(`    .word ${animValuesName}`)
		anim.push(`    .word ${animIndexName}`)

		let indexValues = []

		for (let value of ["x", "y", "z", "w", "p", "r"]) {
			let values = []

			for (let i = 0; i < frames.length; i ++) {
				values.push(Number(findChildFirstValue(frames[i], value)))
			}

			if (values.filter((v) => v != values[0]).length) {
				indexValues.push(loopEnd)
				indexValues.push(animValues.length)

				for (let i = 0; i < loopEnd; i ++) {
					animValues.push(values[i])
				}
			} else {
				indexValues.push(1)

				let offset

				if (animValues.includes(values[0])) {
					offset = animValues.indexOf(values[0])
				} else {
					offset = animValues.push(values[0]) - 1
				}

				indexValues.push(offset)
			}
		}

		animIndex.push(`    .hword ${indexValues.map(paddedHex).join`, `} # ${objectName} part ${partName}`)
	}

	return [
		[
			`${animValuesName}:`,
			chunk(animValues.map(paddedHex), 12).map((line) => `    .hword ${line.join`, `}`).join`\n`
		].join`\n`,
		[
			`${animIndexName}:`,
			animIndex.join`\n`
		].join`\n`,
		anim.join`\n`
	].join`\n\n`
}
