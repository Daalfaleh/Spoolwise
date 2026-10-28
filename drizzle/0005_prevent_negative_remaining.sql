CREATE TRIGGER `prevent_negative_filament_remaining`
BEFORE UPDATE OF `remaining_weight_grams` ON `filaments`
FOR EACH ROW
WHEN NEW.`remaining_weight_grams` < 0
BEGIN
	SELECT RAISE(ABORT, 'INSUFFICIENT_FILAMENT');
END;
