import { Composer } from './composer';

export class BaseScene<C = any> extends Composer<C> {
  id: string;

  constructor(id: string) {
    super();
    this.id = id;
  }

  enter(...fns: any[]) {
    return this.use(...fns);
  }

  leave(...fns: any[]) {
    return this.use(...fns);
  }
}

export class WizardScene<C = any> extends BaseScene<C> {}

export class Stage<C = any> extends Composer<C> {
  scenes: Map<string, BaseScene<C>>;

  constructor(scenes: BaseScene<C>[] = []) {
    super();
    this.scenes = new Map(scenes.map((scene) => [scene.id, scene]));
  }

  register(...scenes: BaseScene<C>[]) {
    for (const scene of scenes) {
      this.scenes.set(scene.id, scene);
    }
    return this;
  }

  static enter(sceneId: string) {
    return (ctx: any) => ctx.scene?.enter?.(sceneId);
  }

  static leave() {
    return (ctx: any) => ctx.scene?.leave?.();
  }
}
