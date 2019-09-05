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

	// Get main loop bounds
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

	// Get names for the parts of the animation
	let animValuesName = `${objectName}_anim_values`
	let animIndexName = `${objectName}_anim_index`
	let animName = `${objectName}_anim`

	let animValues = []
	let animIndex = []

	// We need a masterpart
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
			log(`WARNING: Part ${partName} doesn't have enough frames for the main loop. This means it will loop itself.`)
		}

		for (let j = 0; j < frames.length; j ++) {
			if (frames[j].type != "frame") {
				error(`Expected frame, got node of type ${frames[j].type}`)
			}
		}

		let indexValues = []

		for (let value of (part.type == "masterpart" ? ["x", "y", "z", "w", "p", "r"] : ["w", "p", "r"])) {
			// Get the values for the property for all the frames it's defined
			let values = []

			for (let j = 0; j < frames.length; j ++) {
				values.push(Number(util.findChildFirstValue(frames[j], value)))
			}

			// Find if the values can already be found in the value table
			let idxOfValues = animValues.findIndex((e, i) => util.arrayEquals(animValues.slice(i, i + values.length), values))

			// If the property isn't animated, push an 0x0001 entry
			if (util.allSameElement(values)) {
				indexValues.push(1)

				let offset

				if (animValues.includes(values[0])) {
					offset = animValues.indexOf(values[0])
				} else {
					offset = animValues.push(values[0]) - 1 // Get index of pushed element
				}

				indexValues.push(offset)
			} else if (idxOfValues > -1) {
				// If the values were found in the value table, use that index
				indexValues.push(values.length)
				indexValues.push(idxOfValues)
			} else {
				// If the values are new, push them
				indexValues.push(values.length)
				indexValues.push(animValues.length)

				for (let j = 0; j < values.length; j ++) {
					animValues.push(values[j])
				}
			}
		}

		animIndex.push(`    .hword ${indexValues.map(paddedHex).join`, `} # ${objectName} ${part.type} ${partName}`)
	}

	// Pad to 12 (TODO: odd number of args to .hword cause weird errors, how much do we really need to pad to}?)
	while (animValues.length % 12) {
		animValues.push(0)
	}

	// Write anim header
	let animHeader = [
 		`${animName}:`,
		`    .hword ${paddedHex(0)} # flags`,
		`    .hword ${paddedHex(0)} # unk02`,
		`    .hword ${paddedHex(0)} # starting frame`,
		`    .hword ${paddedHex(loopStart)} # loop start`,
		`    .hword ${paddedHex(loopEnd + 1)} # loop end`, // The loop end in SM64's system is exclusive
		`    .hword ${paddedHex(0)} # unused0A`,
		`    .word ${animValuesName}`,
		`    .word ${animIndexName}`,
        	`    .word  ${paddedHex(0)} # length (unused in objs)`
	]

	// Chain everything together
	return [
		[
			`${animValuesName}:`,
			util.chunk(animValues.map(paddedHex), 12).map((line) => `    .hword ${line.join`, `}`).join`\n`
		].join`\n`,
		[
			`${animIndexName}:`,
			animIndex.join`\n`
		].join`\n`,
		animHeader.join`\n`
	].join`\n\n`
}
