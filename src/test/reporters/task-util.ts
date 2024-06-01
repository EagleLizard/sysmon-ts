import { Arrayable, Task } from 'vitest';
import { Formatter } from './ezd-reporter-colors';

export type GetStatSymbolOpts = {
  colors: {
    pass: Formatter,
    suite: Formatter,
    fail: Formatter,
    skip: Formatter,
  }
};

export type TaskResultsOutput = {
  taskCount: number;
  failed: number;
  passed: number;
  skipped: number;
  todo: number;

  collectTime: number;
  setupTime: number;
  testsTime: number;
  // transformTime: number;
  envTime: number;
  prepareTime: number;
  // threadTime: number;
};

export class TaskUtil {

  /*
    see: https://github.com/vitest-dev/vitest/blob/a820e7ac6efa89b9944094ccc1a7f11ec2afb7ac/packages/vitest/src/node/reporters/renderers/utils.ts#L98
  */
  static getTaskResults(tasks: Task[]): TaskResultsOutput {
    let taskResults: TaskResultsOutput;
    taskResults = {
      taskCount: tasks.length,
      passed: 0,
      failed: 0,
      skipped: 0,
      todo: 0,

      collectTime: 0,
      setupTime: 0,
      testsTime: 0,
      // transformTime: 0,
      envTime: 0,
      prepareTime: 0,
      // threadTime: 0,
    };
    for(let i = 0; i < tasks.length; ++i) {
      let task = tasks[i];
      if(task.result?.state === 'pass') {
        taskResults.passed = taskResults.passed + 1;
      } else if(task.result?.state === 'fail') {
        taskResults.failed = taskResults.failed + 1;
      } else if(task.mode === 'skip') {
        taskResults.skipped = taskResults.skipped + 1;
      } else if(task.mode === 'todo') {
        taskResults.todo = taskResults.todo + 1;
      }

      if(
        (task.type === 'suite')
        && (task.filepath !== undefined)
      ) {
        if(((task as any)?.collectDuration ?? 0) > taskResults.collectTime) {
          taskResults.collectTime += ((task as any)?.collectDuration ?? 0);
        }
        if(((task as any)?.setupDuration ?? 0) > taskResults.setupTime) {
          taskResults.setupTime += (task as any)?.setupDuration ?? 0;
        }
        if((task.result?.duration ?? 0) > taskResults.testsTime) {
          taskResults.testsTime += task.result?.duration ?? 0;
        }
        if(((task as any)?.environmentLoad ?? 0) > taskResults.envTime) {
          taskResults.envTime += (task as any)?.environmentLoad ?? 0;
        }
        if(((task as any)?.prepareDuration ?? 0) > taskResults.prepareTime) {
          taskResults.prepareTime += (task as any)?.prepareDuration ?? 0;
        }
      }
    }
    return taskResults;
  }

  /*
    see: https://github.com/vitest-dev/vitest/blob/b7438b9be28f551cf8d82162e352510a8cbc7b92/packages/runner/src/utils/tasks.ts#L35
  */
  static getSuites(srcTasks: Arrayable<Task>): Task[] {
    let tasks: Task[];
    let resTasks: Task[];
    tasks = Array.isArray(srcTasks)
      ? srcTasks
      : [ srcTasks ]
    ;
    resTasks = [];
    for(let i = 0; i < tasks.length; ++i) {
      let task = tasks[i];
      if(task.type === 'suite') {
        let suiteTasks: Task[];
        resTasks.push(task);
        suiteTasks = TaskUtil.getSuites(task.tasks);
        for(let k = 0; k < suiteTasks.length; ++k) {
          let suiteTask = suiteTasks[k];
          resTasks.push(suiteTask);
        }
      }
    }
    return resTasks;
  }

  static getStateSymbol(task: Task, opts: GetStatSymbolOpts) {
    const colors = opts.colors;
    switch(task.result?.state) {
      case 'pass':
        return colors.pass('✓');
      case 'fail':
        let failSymbol: string;
        failSymbol = (task.type === 'suite')
          ? colors.suite('❯')
          : colors.fail('✗')
        ;
        return failSymbol;
      case 'run':
        return '⏱';
        // return '↻';
      case 'skip':
        // return colors.dimmer.bold('↓');
        return colors.skip('↓');
      default:
        return ' ';
    }
  }

  /*
    see:
      https://github.com/vitest-dev/vitest/blob/b7438b9be28f551cf8d82162e352510a8cbc7b92/packages/runner/src/utils/tasks.ts
  */
  static getTests(task: Arrayable<Task>): Task[] {
    let tests: Task[];
    let suites: Task[];
    tests = [];
    suites = Array.isArray(task)
      ? task
      : [ task ]
    ;
    for(let i = 0; i < suites.length; ++i) {
      let currSuite = suites[i];
      if(TaskUtil.isAtomTest(currSuite)) {
        tests.push(currSuite);
      // } else if(Array.isArray(currSuite.suite?.tasks)) {
      } else if(currSuite.type === 'suite') {
        for(let k = 0; k < currSuite.tasks.length; ++k) {
          let currTask = currSuite.tasks[k];
          if(TaskUtil.isAtomTest(currTask)) {
            tests.push(currTask);
          } else {
            // console.log(currTask.filepath);
            let taskTests = TaskUtil.getTests(currTask);
            for(let j = 0; j < taskTests.length; ++j) {
              let currTest = taskTests[j];
              tests.push(currTest);
            }
          }
        }
      }
    }
    return tests;
  }

  static taskComparator<T extends Task>(a: T, b: T) {
    let aSkip: boolean;
    let bSkip: boolean;
    aSkip = (a.mode === 'skip') || (a.mode === 'todo');
    bSkip = (b.mode === 'skip') || (b.mode === 'todo');
    if(aSkip && !bSkip) {
      return -1;
    } else if(!aSkip && bSkip) {
      return 1;
    } else {
      return 0;
    }
  }

  static isAtomTest(task: Task): boolean {
    return (
      (task.type === 'test')
      || (task.type === 'custom')
    );
  }

  /*
    see: https://github.com/vitest-dev/vitest/blob/0766b7f72ef4d8b5357fc002b562ff7721963616/packages/vitest/src/utils/tasks.ts#L18
  */

  static getFullName(task: Task, separator = ' > '): string {
    let fullName: string;
    fullName = TaskUtil.getNames(task).join(separator);
    return fullName;
  }

  /*
    see: https://github.com/vitest-dev/vitest/blob/0766b7f72ef4d8b5357fc002b562ff7721963616/packages/runner/src/utils/tasks.ts#L47
  */
  static getNames(task: Task): string[] {
    let names: string[];
    let currTask: Task | undefined;
    names = [ task.name ];
    currTask = task;
    while(currTask?.suite !== undefined) {
      currTask = currTask.suite;
      if(currTask.name !== undefined) {
        names.push(currTask.name);
      }
    }

    if(
      (task.file !== undefined)
      && (currTask !== task.file)
    ) {
      names.push(task.file.name);
    }
    names.reverse();
    return names;
  }

  static isSkippedTask(task: Task) {
    return (
      (task.mode === 'skip')
      || (task.mode === 'todo')
    );
  }
}
