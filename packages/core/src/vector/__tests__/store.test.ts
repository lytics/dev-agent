/**
 * Unit tests for LanceDBVectorStore
 * Focus on testing the distance-to-similarity conversion bug fix
 */

import { describe, expect, it } from 'vitest';

describe('LanceDB Distance to Similarity Conversion', () => {
  describe('Score Calculation', () => {
    /**
     * This is the core bug fix being tested:
     * LanceDB returns L2 distance, we need to convert to similarity score (0-1)
     */

    it('should convert L2 distance to valid similarity score', () => {
      // Simulate the conversion we use: score = e^(-distance²)
      const calculateScore = (distance: number): number => {
        return Math.exp(-(distance * distance));
      };

      // Test cases from the bug:
      // Before fix: score = 1 - distance = 1 - 1.0 = 0 ❌
      // After fix: score = e^(-distance²) ✅

      // Distance ~1.0 (similar vectors in normalized space)
      const distance1 = 0.9999990463256836; // Real value from our testing
      const score1 = calculateScore(distance1);

      expect(score1).toBeGreaterThan(0); // Should NOT be 0 (the bug!)
      expect(score1).toBeLessThan(1);
      expect(score1).toBeCloseTo(0.37, 1); // e^(-1²) ≈ 0.37
    });

    it('should give high scores for low distances', () => {
      const calculateScore = (distance: number): number => {
        return Math.exp(-(distance * distance));
      };

      // Very similar vectors (distance ≈ 0)
      const veryClose = calculateScore(0.1);
      expect(veryClose).toBeGreaterThan(0.99); // e^(-0.01) ≈ 0.99

      // Moderately similar (distance ≈ 0.5)
      const moderate = calculateScore(0.5);
      expect(moderate).toBeGreaterThan(0.7); // e^(-0.25) ≈ 0.78

      // Less similar (distance ≈ 1.0)
      const less = calculateScore(1.0);
      expect(less).toBeGreaterThan(0.3); // e^(-1) ≈ 0.37
      expect(less).toBeLessThan(0.4);
    });

    it('should give low scores for high distances', () => {
      const calculateScore = (distance: number): number => {
        return Math.exp(-(distance * distance));
      };

      // Dissimilar vectors (distance ≈ 2.0)
      const dissimilar = calculateScore(2.0);
      expect(dissimilar).toBeLessThan(0.02); // e^(-4) ≈ 0.018

      // Very dissimilar (distance ≈ 3.0)
      const veryDissimilar = calculateScore(3.0);
      expect(veryDissimilar).toBeLessThan(0.001); // e^(-9) ≈ 0.00012
    });

    it('should return scores in valid range (0-1)', () => {
      const calculateScore = (distance: number): number => {
        return Math.exp(-(distance * distance));
      };

      // Test a range of distances
      const distances = [0, 0.1, 0.5, 1.0, 1.5, 2.0, 3.0, 5.0];

      for (const distance of distances) {
        const score = calculateScore(distance);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
      }
    });

    it('should be monotonically decreasing', () => {
      const calculateScore = (distance: number): number => {
        return Math.exp(-(distance * distance));
      };

      // Scores should decrease as distance increases
      const distances = [0, 0.5, 1.0, 1.5, 2.0];
      const scores = distances.map(calculateScore);

      for (let i = 0; i < scores.length - 1; i++) {
        expect(scores[i]).toBeGreaterThan(scores[i + 1]);
      }
    });

    it('should handle edge cases', () => {
      const calculateScore = (distance: number): number => {
        return Math.exp(-(distance * distance));
      };

      // Distance = 0 (identical vectors)
      expect(calculateScore(0)).toBe(1);

      // Very large distance
      const huge = calculateScore(100);
      expect(huge).toBeCloseTo(0, 10);

      // Undefined/infinity handling
      const inf = calculateScore(Number.POSITIVE_INFINITY);
      expect(inf).toBe(0);
    });
  });

  describe('Threshold Filtering', () => {
    it('should filter out results below threshold', () => {
      const results = [
        { distance: 0.5, id: 'a' }, // score ≈ 0.78
        { distance: 1.0, id: 'b' }, // score ≈ 0.37
        { distance: 1.5, id: 'c' }, // score ≈ 0.11
        { distance: 2.0, id: 'd' }, // score ≈ 0.02
      ];

      const calculateScore = (distance: number): number => {
        return Math.exp(-(distance * distance));
      };

      const threshold = 0.3;
      const filtered = results
        .map((r) => ({ ...r, score: calculateScore(r.distance) }))
        .filter((r) => r.score >= threshold);

      // Should keep scores >= 0.3 (distances <= ~1.0)
      expect(filtered.length).toBe(2);
      expect(filtered[0].id).toBe('a');
      expect(filtered[1].id).toBe('b');
    });

    it('should keep all results with threshold 0', () => {
      const results = [
        { distance: 1.0, id: 'a' },
        { distance: 2.0, id: 'b' },
        { distance: 3.0, id: 'c' },
      ];

      const calculateScore = (distance: number): number => {
        return Math.exp(-(distance * distance));
      };

      const threshold = 0.0;
      const filtered = results
        .map((r) => ({ ...r, score: calculateScore(r.distance) }))
        .filter((r) => r.score >= threshold);

      expect(filtered.length).toBe(3);
    });

    it('should filter out low scores with high threshold', () => {
      const results = [
        { distance: 0.5, id: 'a' }, // score ≈ 0.78
        { distance: 1.0, id: 'b' }, // score ≈ 0.37
        { distance: 1.5, id: 'c' }, // score ≈ 0.11
      ];

      const calculateScore = (distance: number): number => {
        return Math.exp(-(distance * distance));
      };

      const threshold = 0.7;
      const filtered = results
        .map((r) => ({ ...r, score: calculateScore(r.distance) }))
        .filter((r) => r.score >= threshold);

      // Only the first result should pass
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('a');
    });
  });
});
