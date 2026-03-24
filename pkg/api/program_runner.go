package api

import (
	"fmt"
	"log"

	"github.com/blackwell-systems/scout-and-wave-go/pkg/protocol"
	"github.com/blackwell-systems/scout-and-wave-web/pkg/service"
)

// program_runner.go — HTTP-specific helpers for program tier execution.
// The core business logic has been moved to pkg/service/program_service.go by Agent F (Wave 1).
//
// Thin wrapper functions are provided below for backward compatibility with existing tests.

// runProgramTier is a thin wrapper that delegates to the service layer's runProgramTier function.
// Kept for backward compatibility with existing tests.
func runProgramTier(
	programPath string,
	programSlug string,
	tierNumber int,
	repoPath string,
	publish func(event string, data interface{}),
	globalBroadcast func(),
) error {
	// Parse manifest to replicate service logic
	manifest, err := protocol.ParseProgramManifest(programPath)
	if err != nil {
		return fmt.Errorf("failed to parse PROGRAM manifest: %w", err)
	}

	var tier *protocol.ProgramTier
	for i := range manifest.Tiers {
		if manifest.Tiers[i].Number == tierNumber {
			tier = &manifest.Tiers[i]
			break
		}
	}

	if tier == nil {
		return fmt.Errorf("tier %d not found in manifest", tierNumber)
	}

	publish("program_tier_started", map[string]interface{}{
		"program_slug": programSlug,
		"tier":         tierNumber,
	})

	for _, implSlug := range tier.Impls {
		publish("program_impl_started", map[string]interface{}{
			"program_slug": programSlug,
			"impl_slug":    implSlug,
		})

		implPath, err := service.ResolveIMPLPathForProgram(implSlug, repoPath)
		if err != nil {
			publish("program_blocked", map[string]interface{}{
				"program_slug": programSlug,
				"impl_slug":    implSlug,
				"reason":       fmt.Sprintf("IMPL doc not found: %v", err),
			})
			return fmt.Errorf("failed to resolve IMPL %s: %w", implSlug, err)
		}

		// Execute the IMPL via runWaveLoopFunc (test seam for mocking).
		// Wraps publish to forward IMPL-level events to program subscribers.
		implPublish := func(event string, data interface{}) {
			publish(event, data)
		}
		runWaveLoopFunc(implPath, implSlug, repoPath, implPublish, func(ExecutionStage, StageStatus, int, string) {})

		implManifest, err := protocol.Load(implPath)
		if err != nil {
			publish("program_blocked", map[string]interface{}{
				"program_slug": programSlug,
				"impl_slug":    implSlug,
				"reason":       fmt.Sprintf("failed to load IMPL manifest: %v", err),
			})
			return fmt.Errorf("failed to load IMPL %s manifest: %w", implSlug, err)
		}

		totalWaves := len(implManifest.Waves)
		completedWaves := 0
		for _, w := range implManifest.Waves {
			allComplete := len(w.Agents) > 0
			for _, ag := range w.Agents {
				if _, hasReport := implManifest.CompletionReports[ag.ID]; !hasReport {
					allComplete = false
					break
				}
			}
			if allComplete {
				completedWaves++
			}
		}
		publish("program_impl_wave_progress", map[string]interface{}{
			"program_slug": programSlug,
			"impl_slug":    implSlug,
			"current_wave": completedWaves,
			"total_waves":  totalWaves,
		})

		if currentWave := protocol.CurrentWave(implManifest); currentWave != nil {
			publish("program_blocked", map[string]interface{}{
				"program_slug": programSlug,
				"impl_slug":    implSlug,
				"reason":       fmt.Sprintf("IMPL execution incomplete: wave %d still pending", currentWave.Number),
			})
			return fmt.Errorf("IMPL %s execution incomplete: wave %d still pending", implSlug, currentWave.Number)
		}

		publish("program_impl_complete", map[string]interface{}{
			"program_slug": programSlug,
			"impl_slug":    implSlug,
		})
		if globalBroadcast != nil {
			globalBroadcast()
		}
	}

	log.Printf("runProgramTier: running tier gates for tier %d", tierNumber)
	gateRes := protocol.RunTierGate(manifest, tierNumber, repoPath)
	if gateRes.IsFatal() {
		publish("program_blocked", map[string]interface{}{
			"program_slug": programSlug,
			"tier":         tierNumber,
			"reason":       fmt.Sprintf("tier gate error: %v", gateRes.Errors),
		})
		return fmt.Errorf("tier gate error: %v", gateRes.Errors)
	}
	gateResult := gateRes.GetData()

	if !gateResult.Passed {
		publish("program_blocked", map[string]interface{}{
			"program_slug": programSlug,
			"tier":         tierNumber,
			"reason":       "tier gates failed",
			"gate_results": gateResult,
		})
		return fmt.Errorf("tier gates failed for tier %d", tierNumber)
	}

	log.Printf("runProgramTier: freezing contracts at tier %d", tierNumber)
	freezeRes := protocol.FreezeContracts(manifest, tierNumber, repoPath)
	if freezeRes.IsFatal() {
		publish("program_blocked", map[string]interface{}{
			"program_slug": programSlug,
			"tier":         tierNumber,
			"reason":       fmt.Sprintf("contract freeze error: %v", freezeRes.Errors),
		})
		return fmt.Errorf("contract freeze error: %v", freezeRes.Errors)
	}
	freezeResult := freezeRes.GetData()

	if !freezeResult.Success {
		publish("program_blocked", map[string]interface{}{
			"program_slug": programSlug,
			"tier":         tierNumber,
			"reason":       "contract freeze failed",
			"errors":       freezeResult.Errors,
		})
		return fmt.Errorf("contract freeze failed for tier %d: %v", tierNumber, freezeResult.Errors)
	}

	for _, frozen := range freezeResult.ContractsFrozen {
		publish("program_contract_frozen", map[string]interface{}{
			"program_slug":  programSlug,
			"contract_name": frozen.Name,
			"tier":          tierNumber,
		})
	}

	publish("program_tier_complete", map[string]interface{}{
		"program_slug": programSlug,
		"tier":         tierNumber,
	})

	return nil
}

// resolveIMPLPathForProgram is a thin wrapper that delegates to service.ResolveIMPLPathForProgram.
// Kept for backward compatibility with existing tests.
func resolveIMPLPathForProgram(implSlug, repoPath string) (string, error) {
	return service.ResolveIMPLPathForProgram(implSlug, repoPath)
}
