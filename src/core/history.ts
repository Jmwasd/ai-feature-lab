import type { Command } from './commands'
import type { Scene } from './types'

export class History {
  private undoStack: Command[] = []
  private redoStack: Command[] = []

  get canUndo() {
    return this.undoStack.length > 0
  }

  get canRedo() {
    return this.redoStack.length > 0
  }

  /** 커맨드를 실행하고 히스토리에 기록 */
  execute(cmd: Command, scene: Scene): Scene {
    const next = cmd.apply(scene)
    this.undoStack.push(cmd)
    this.redoStack.length = 0
    return next
  }

  /**
   * 이미 씬에 반영된 변경을 히스토리에만 기록.
   * 드래그처럼 진행 중 계속 씬을 갱신하다가
   * 조작이 끝나는 시점에 한 번만 기록해야 하는 경우에 쓴다.
   */
  push(cmd: Command): void {
    this.undoStack.push(cmd)
    this.redoStack.length = 0
  }

  undo(scene: Scene): Scene {
    const cmd = this.undoStack.pop()
    if (!cmd) return scene
    this.redoStack.push(cmd)
    return cmd.invert(scene)
  }

  redo(scene: Scene): Scene {
    const cmd = this.redoStack.pop()
    if (!cmd) return scene
    this.undoStack.push(cmd)
    return cmd.apply(scene)
  }
}
