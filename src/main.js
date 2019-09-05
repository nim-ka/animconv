const getArgs = require("./args.js")
const parseAnimFile = require("./parse.js")
const error = require("./error.js")
const util = require("./util.js")

const fs = require("fs")

let args = getArgs(process.argv.slice(2), {
	"--help":    { len: 0, short: "-h" },
	"--decimal": { len: 0, short: "-d" },
	"--output":  { len: 1, short: "-o" },
	"--verbose": { len: 0, short: "-v" }
})

function log (msg) {
	if (args["--output"] || args["--verbose"]) {
		process.stdout.write(`${msg}\n`)
	}
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
		`\t\tOutputs to outfile.`,
		`\t-v / --verbose:`,
		`\t\tLogs steps of the process when outputting to stdout.`,
		`\t\tHas no effect when -o is used, as logs are printed regardless.`
	].join`\n`)
} else {
	let filename = args.identifiers[0].value

	if (!filename) {
		error(`No filename found`)
	}

	let animFile = parseAnimFile(filename, log)

	if (!animFile) {
		error(`Could not open file ${filename}. (Did you pass one too many arguments to ${args.identifiers[0].lastOption}?)`)
	}

	if (animFile.type != "object") {
		error(`Animation file data is non-supported type ${animFile.type}; try wrapping with .object`)
	}

	log("Processing object...")

	let output = processObject(animFile)

	log("Done!")
	log("Writing...")

	if (args["--output"]) {
		fs.writeFile(args["--output"][0], output + "\n", () => console.log("Done!"));
	} else {
		if (args["--verbose"]) {
			console.log("-----")
		}

		console.log(output)
	}
}

function processObject (object) {
	let objectName = util.getFirstValue(object)

	let loopStart = object.children[1]

	if (loopStart.type == "loopStart") {
		loopStart = Number(util.getFirstValue(loopStart))
	} else {
		error(`Expected loopStart, got ${loopStart.type}`)
	}

	let loopEnd = object.children[2]

	if (loopEnd.type == "loopEnd") {
		loopEnd = Number(util.getFirstValue(loopEnd))
	} else {
		error(`Expected loopEnd, got ${loopEnd.type}`)
	}

	let parts = object.children.slice(3)

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

	if (parts[0].type != "masterpart") {
		error(`Part 0 should be a masterpart`)
	}

	for (let i = 0; i < parts.length; i ++) {
		let part = parts[i]
		let partName = util.getFirstValue(part)

		if (i > 0 && parts[i].type == "masterpart") {
			error(`Part ${i} is a masterpart! There can only be one masterpart.`)
		}

		let frames = part.children.slice(1)

		if (frames.length - 1 > loopEnd) {
			error(`Unnecessary frames after end of loop`)
		}

		if (frames.length - 1 < loopEnd) {
			error(`Not enough frames for the loop! This will result in corrupted animations!`)
		}

		for (let j = 0; j < frames.length; j ++) {
			if (frames[j].type != "frame") {
				error(`Expected frame, got node of type ${frames[j].type}`)
			}
		}

		let indexValues = []

		for (let value of (part.type == "masterpart" ? ["x", "y", "z", "w", "p", "r"] : ["w", "p", "r"])) {
			let values = []

			for (let j = 0; j < frames.length; j ++) {
				values.push(Number(util.findChildFirstValue(frames[j], value)))
			}

			let idxOfValues = animValues.findIndex((e, i) => util.arrayEquals(animValues.slice(i, i + values.length), values))

			if (util.allSameElement(values)) {
				indexValues.push(1)

				let offset

				if (animValues.includes(values[0])) {
					offset = animValues.indexOf(values[0])
				} else {
					offset = animValues.push(values[0]) - 1
				}

				indexValues.push(offset)
			} else if (idxOfValues > -1) {
				indexValues.push(loopEnd)
				indexValues.push(idxOfValues)
			} else {
				indexValues.push(loopEnd)
				indexValues.push(animValues.length)

				for (let j = 0; j < values.length; j ++) {
					animValues.push(values[j])
				}
			}
		}

		animIndex.push(`    .hword ${indexValues.map(paddedHex).join`, `} # ${objectName} ${part.type} ${partName}`)
	}

	while (animValues.length % 12) {
		animValues.push(0)
	}

	anim.push(`    .hword ${paddedHex(loopStart)} # loop start`)
	anim.push(`    .hword ${paddedHex(loopEnd)} # loop end`)
	anim.push(`    .hword ${paddedHex(0)} # unused0A`)
	anim.push(`    .word ${animValuesName}`)
	anim.push(`    .word ${animIndexName}`)
        anim.push(`    .word  ${paddedHex(0)} # length (unused in objs)`)

	return [
		[
			`${animValuesName}:`,
			util.chunk(animValues.map(paddedHex), 12).map((line) => `    .hword ${line.join`, `}`).join`\n`
		].join`\n`,
		[
			`${animIndexName}:`,
			animIndex.join`\n`
		].join`\n`,
		anim.join`\n`
	].join`\n\n`
}
