export function echoFrameAt(frames, time) {
  let low = 0, high = frames.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (frames[mid].time <= time) low = mid;
    else high = mid - 1;
  }
  return frames[low];
}

export function findUsableDoor(doors, x, z) {
  return doors.find(door => !door.unlocked && Math.hypot(door.x - x, door.z - z) < 5);
}
