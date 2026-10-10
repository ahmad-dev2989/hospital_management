$lines = Get-Content 'src\backend\HospitalApp.Infrastructure\Migrations\ApplicationDbContextModelSnapshot.cs'
$entity = ''

foreach ($line in $lines) {
    if ($line -match 'modelBuilder\.Entity\("HospitalApp\.Core\.Entities\.(\w+)"') {
        $entity = $matches[1]
    } elseif ($entity -and $line -match 'b\.HasOne\("HospitalApp\.Core\.Entities\.(\w+)",\s*("([^"]+)"|null)\)') {
        $target = $matches[1]
        $nav = $matches[3]
        Write-Host "$entity -> $target ($nav)"
    }
}
