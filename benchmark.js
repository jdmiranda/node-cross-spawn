'use strict';

const spawn = require('./index.js');
const cp = require('child_process');

// Benchmark configuration
const ITERATIONS = 10000;
const WARMUP_ITERATIONS = 1000;

// Utility function to measure execution time
function benchmark(name, fn, iterations = ITERATIONS) {
    // Warmup
    for (let i = 0; i < WARMUP_ITERATIONS; i += 1) {
        fn();
    }

    // Actual benchmark
    const start = process.hrtime.bigint();

    for (let i = 0; i < iterations; i += 1) {
        fn();
    }
    const end = process.hrtime.bigint();
    const totalMs = Number(end - start) / 1000000;
    const avgMs = totalMs / iterations;

    console.log(`${name}:`);
    console.log(`  Total: ${totalMs.toFixed(2)}ms`);
    console.log(`  Average: ${avgMs.toFixed(4)}ms`);
    console.log(`  Ops/sec: ${(1000 / avgMs).toFixed(0)}`);
    console.log('');

    return { totalMs, avgMs };
}

console.log('='.repeat(60));
console.log('Cross-Spawn Performance Benchmark');
console.log('='.repeat(60));
console.log('');

// 1. Command Parsing Speed
console.log('1. Command Parsing Speed');
console.log('-'.repeat(60));

benchmark('Parse simple command (cached)', () => {
    spawn._parse('echo', ['hello']);
});

benchmark('Parse simple command (varied - less cache hits)', () => {
    const cmds = ['echo', 'ls', 'cat', 'grep', 'node'];
    const cmd = cmds[Math.floor(Math.random() * cmds.length)];

    spawn._parse(cmd, ['arg']);
});

benchmark('Parse command with multiple args (cached)', () => {
    spawn._parse('node', ['script.js', '--flag', 'value']);
});

benchmark('Parse with options (cached)', () => {
    spawn._parse('echo', ['hello'], { cwd: '/tmp' });
});

console.log('');

// 2. Spawn Call Overhead
console.log('2. Spawn() Call Overhead (without execution)');
console.log('-'.repeat(60));

// Measure just the parsing and setup overhead (not actual process spawn)
benchmark('cross-spawn parse overhead', () => {
    spawn._parse('echo', ['test']);
}, 50000);

benchmark('cross-spawn parse with shell option', () => {
    spawn._parse('echo', ['test'], { shell: true });
}, 50000);

console.log('');

// 3. Options Processing Performance
console.log('3. Options Processing Performance');
console.log('-'.repeat(60));

benchmark('Parse with empty options', () => {
    spawn._parse('echo', ['hello'], {});
});

benchmark('Parse with cwd option', () => {
    spawn._parse('echo', ['hello'], { cwd: '/tmp' });
});

benchmark('Parse with env option', () => {
    spawn._parse('echo', ['hello'], { env: process.env });
});

benchmark('Parse with multiple options', () => {
    spawn._parse('echo', ['hello'], {
        cwd: '/tmp',
        env: process.env,
        stdio: 'pipe',
    });
});

console.log('');

// 4. Cache Effectiveness Test
console.log('4. Cache Effectiveness Test');
console.log('-'.repeat(60));

// First run - cache miss
const firstRun = benchmark('First run (cache miss)', () => {
    spawn._parse(`test-command-unique-${Math.random()}`, ['arg']);
}, 1000);

// Second run - same command (cache hit on Unix)
const secondRun = benchmark('Repeated command (cache hit expected on Unix)', () => {
    spawn._parse('echo', ['hello']);
}, 1000);

const improvement = ((firstRun.avgMs - secondRun.avgMs) / firstRun.avgMs * 100).toFixed(1);

console.log(`Cache performance improvement: ${improvement}%`);
console.log('');

// 5. Real spawn execution test (limited iterations)
console.log('5. Real Process Spawn Performance (Limited Test)');
console.log('-'.repeat(60));

const SPAWN_ITERATIONS = 100;

function runCrossSpawn(onComplete) {
    const start = process.hrtime.bigint();
    let count = 0;

    function handleClose() {
        count += 1;
        if (count === SPAWN_ITERATIONS) {
            const end = process.hrtime.bigint();
            const time = Number(end - start) / 1000000;

            onComplete(time);
        }
    }

    for (let i = 0; i < SPAWN_ITERATIONS; i += 1) {
        const child = spawn('echo', ['test']);

        child.on('close', handleClose);
    }
}

function runNativeSpawn(onComplete) {
    const start = process.hrtime.bigint();
    let count = 0;

    function handleClose() {
        count += 1;
        if (count === SPAWN_ITERATIONS) {
            const end = process.hrtime.bigint();
            const time = Number(end - start) / 1000000;

            onComplete(time);
        }
    }

    for (let i = 0; i < SPAWN_ITERATIONS; i += 1) {
        const child = cp.spawn('echo', ['test']);

        child.on('close', handleClose);
    }
}

runCrossSpawn((crossSpawnTime) => {
    runNativeSpawn((nativeTime) => {
        console.log(`cross-spawn: ${crossSpawnTime.toFixed(2)}ms (${(crossSpawnTime / SPAWN_ITERATIONS).toFixed(2)}ms avg)`);
        console.log(`native spawn: ${nativeTime.toFixed(2)}ms (${(nativeTime / SPAWN_ITERATIONS).toFixed(2)}ms avg)`);
        console.log(`Overhead: ${(crossSpawnTime - nativeTime).toFixed(2)}ms (${((crossSpawnTime - nativeTime) / SPAWN_ITERATIONS).toFixed(2)}ms per spawn)`);
        console.log('');
        console.log('='.repeat(60));
        console.log('Benchmark Complete');
        console.log('='.repeat(60));
    });
});
