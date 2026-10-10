$lines = Get-Content 'src\backend\HospitalApp.Infrastructure\Migrations\ApplicationDbContextModelSnapshot.cs'
$entity = ''
$props = @()
$dict = [System.Collections.Generic.Dictionary[string, System.Collections.Generic.List[string]]]::new()

foreach ($line in $lines) {
    if ($line -match 'modelBuilder\.Entity\("HospitalApp\.Core\.Entities\.(\w+)"') {
        $entity = $matches[1]
        if (-not $dict.ContainsKey($entity)) {
            $dict[$entity] = [System.Collections.Generic.List[string]]::new()
        }
    } elseif ($entity -and $line -match 'b\.Property<([^>]+)>\("([^"]+)"\)') {
        $type = $matches[1]
        $prop = $matches[2]
        $dict[$entity].Add("$prop : $type")
    }
}

foreach ($k in $dict.Keys) {
    Write-Host "=== $k ==="
    foreach ($p in $dict[$k]) {
        Write-Host "  $p"
    }
}
