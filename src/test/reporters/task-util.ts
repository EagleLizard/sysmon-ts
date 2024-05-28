import { Arrayable, Task } from 'vitest';

export class TaskUtil {
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
}
