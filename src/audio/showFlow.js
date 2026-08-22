export const SHOW_PHASE = Object.freeze({
  SETUP: 'setup',
  READY: 'ready',
  TRANSITIONING: 'transitioning',
  LIVE: 'live',
  PAUSED: 'paused',
  RESTORING: 'restoring',
  ERROR: 'error',
});

export { nextPlaylistIndex } from './playlist';

const reportPhase = (onPhase, phase) => {
  if (onPhase) onPhase(phase);
};

export async function startPerformanceFlow({
  lowerBackground,
  playPerformance,
  restoreBackground,
  onPhase,
}) {
  reportPhase(onPhase, SHOW_PHASE.TRANSITIONING);
  await lowerBackground();

  try {
    await playPerformance();
    reportPhase(onPhase, SHOW_PHASE.LIVE);
  } catch (error) {
    reportPhase(onPhase, SHOW_PHASE.RESTORING);
    try {
      await restoreBackground();
    } finally {
      reportPhase(onPhase, SHOW_PHASE.ERROR);
    }
    throw error;
  }
}

export async function finishPerformanceFlow({ restoreBackground, onPhase }) {
  reportPhase(onPhase, SHOW_PHASE.RESTORING);
  await restoreBackground();
  reportPhase(onPhase, SHOW_PHASE.READY);
}

export function getShowReadiness({
  assignedPerformances,
}) {
  if (assignedPerformances < 1) {
    return { phase: SHOW_PHASE.SETUP, label: 'Assign a performance', ready: false };
  }
  return { phase: SHOW_PHASE.READY, label: 'Show ready', ready: true };
}

export function getShowDeckState({
  ready,
  assignments = [],
  completed = [],
  currentPerformance = null,
}) {
  const incompleteAssigned = assignments
    .map((assigned, index) => ({ assigned: Boolean(assigned), index }))
    .filter(({ assigned, index }) => assigned && !completed[index]);
  const isLive = Number.isInteger(currentPerformance) && currentPerformance >= 0;
  const nextPerformance = incompleteAssigned.find(({ index }) => (
    !isLive || index !== currentPerformance
  ));

  return {
    mode: isLive ? 'live' : (ready ? 'ready' : 'prep'),
    activePerformanceIndex: isLive ? currentPerformance : null,
    nextPerformanceIndex: nextPerformance?.index ?? null,
    remainingAssignedCount: incompleteAssigned.length,
  };
}

export function shouldShowRunDeck({ mode, hasAudio }) {
  return mode !== 'prep' || Boolean(hasAudio);
}

export function promotePerformanceOrder({ order, activeIndex, completed = [] }) {
  if (!order.includes(activeIndex)) return order;
  const remaining = order.filter(index => index !== activeIndex);
  const nextOpenPosition = remaining.findIndex(index => !completed[index]);
  const insertAt = nextOpenPosition < 0 ? remaining.length : nextOpenPosition;
  return [
    ...remaining.slice(0, insertAt),
    activeIndex,
    ...remaining.slice(insertAt),
  ];
}

export function isPerformanceCycleComplete({ assignments = [], completed = [] }) {
  return assignments.some(Boolean) && assignments.every((assigned, index) => (
    !assigned || Boolean(completed[index])
  ));
}

export function visiblePerformanceOrder({
  order = [],
  assignments = [],
  hasStarted = false,
  draftIndex = null,
}) {
  if (!hasStarted) return order;
  return order.filter(index => Boolean(assignments[index]) || index === draftIndex);
}
