import { AnimationController, Animation } from '@ionic/angular';

export const fadeAnimation = (
  _baseEl: HTMLElement,
  opts?: { enteringEl: HTMLElement; leavingEl?: HTMLElement }
): Animation => {
  const animationCtrl = new AnimationController();
  const enteringEl = opts?.enteringEl as HTMLElement;
  const leavingEl = opts?.leavingEl as HTMLElement | undefined;

  const enterAnimation = animationCtrl
    .create()
    .addElement(enteringEl)
    .duration(280)
    .easing('cubic-bezier(0.4, 0, 0.2, 1)')
    .fromTo('opacity', '0', '1')
    .fromTo('transform', 'translateY(12px)', 'translateY(0)');

  let leaveAnimation: Animation | undefined;
  if (leavingEl) {
    leaveAnimation = animationCtrl
      .create()
      .addElement(leavingEl)
      .duration(180)
      .easing('cubic-bezier(0.4, 0, 0.2, 1)')
      .fromTo('opacity', '1', '0')
      .fromTo('transform', 'translateY(0)', 'translateY(-8px)');
  }

  const animation = animationCtrl.create().addAnimation(enterAnimation);
  if (leaveAnimation) {
    animation.addAnimation(leaveAnimation);
  }
  return animation;
};
