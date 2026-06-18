import { describe, it, expect } from 'vitest';
import { deriveGeometry } from '../src/dimension-deriver';
import type { Dimension } from '../src/index';

const dim = (value: number, unit: string): Dimension => ({ value, unit });

describe('deriveGeometry (T3.1)', () => {
  it('circle: diameter = √(4·surfaceArea/π)', () => {
    const { geometry, notes } = deriveGeometry('clarifier', { surfaceArea: dim(1000, 'm2'), depth: dim(3.5, 'm') });
    expect(geometry.shape).toBe('circle');
    expect(geometry.diameterM!.value).toBeCloseTo(35.68, 1);
    expect(geometry.footprint.lengthM).toBeCloseTo(35.68, 1);
    expect(notes.every((n) => n.startsWith('layout geometry assumption:'))).toBe(true);
  });

  it('rectangle: footprint area = volume/depth, L:W ≈ 2:1', () => {
    const { geometry } = deriveGeometry('reactor', { volume: dim(5000, 'm3'), depth: dim(4.5, 'm') });
    expect(geometry.shape).toBe('rectangle');
    const area = geometry.footprint.lengthM * geometry.footprint.widthM;
    expect(area).toBeCloseTo(1111, 0);
    expect(geometry.footprint.lengthM / geometry.footprint.widthM).toBeCloseTo(2, 2);
    expect(geometry.capacity).toEqual({ value: 5000, unit: 'm3' });
  });

  it('rectangle: heightM = water depth + 0.5 m freeboard', () => {
    const { geometry } = deriveGeometry('tank', { volume: dim(5000, 'm3'), depth: dim(4.5, 'm') });
    expect(geometry.heightM!.value).toBe(5.0);
    expect(geometry.freeboardM!.value).toBe(0.5);
  });

  it('skid: standard footprint from the lookup (no sizing needed)', () => {
    expect(deriveGeometry('blower', {}).geometry.footprint).toEqual({ lengthM: 2.4, widthM: 1.6 });
    expect(deriveGeometry('dosing_skid', {}).geometry.footprint).toEqual({ lengthM: 4.5, widthM: 3.0 });
    expect(deriveGeometry('pump', {}).geometry.footprint).toEqual({ lengthM: 2.0, widthM: 1.2 });
  });

  it('always labels outputs as a layout geometry assumption', () => {
    const { notes } = deriveGeometry('reactor', { volume: dim(3000, 'm3'), depth: dim(4, 'm') });
    expect(notes.length).toBeGreaterThan(0);
    expect(notes.every((n) => n.startsWith('layout geometry assumption:'))).toBe(true);
  });

  it('is deterministic', () => {
    const a = deriveGeometry('clarifier', { surfaceArea: dim(1000, 'm2') });
    const b = deriveGeometry('clarifier', { surfaceArea: dim(1000, 'm2') });
    expect(a).toEqual(b);
  });
});
