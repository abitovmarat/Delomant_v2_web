param(
    [string]$TemplatePath = "документация для проверки\Документация,_содержащая_описание_процессов,_обеспечивающих_поддержание.docx",
    [string]$MarkdownPath = "docs\reestr\expertiza\4_Информация_для_эксплуатации.md",
    [string]$OutputPath = "docs\reestr\expertiza\4_Информация_для_эксплуатации_Delomant_0.9.docx"
)

$ErrorActionPreference = "Stop"

function Release-ComObject {
    param($Object)
    if ($null -ne $Object) {
        try { [Runtime.InteropServices.Marshal]::ReleaseComObject($Object) | Out-Null } catch {}
    }
}

function Set-ParagraphText {
    param($Paragraph, [string]$Text)
    $range = $Paragraph.Range.Duplicate
    $range.End = $range.End - 1
    $range.Text = $Text
    Release-ComObject $range
}

function Convert-InlineMarkdown {
    param([string]$Text)

    $matches = [regex]::Matches($Text, '(\*\*.*?\*\*|`[^`]+`)')
    $plain = [Text.StringBuilder]::new()
    $spans = [Collections.Generic.List[object]]::new()
    $cursor = 0

    foreach ($match in $matches) {
        [void]$plain.Append($Text.Substring($cursor, $match.Index - $cursor))
        $raw = $match.Value
        $kind = if ($raw.StartsWith('**')) { 'bold' } else { 'code' }
        $value = if ($kind -eq 'bold') { $raw.Substring(2, $raw.Length - 4) } else { $raw.Substring(1, $raw.Length - 2) }
        $start = $plain.Length
        [void]$plain.Append($value)
        $spans.Add([pscustomobject]@{ Start = $start; Length = $value.Length; Kind = $kind })
        $cursor = $match.Index + $match.Length
    }

    [void]$plain.Append($Text.Substring($cursor))
    [pscustomobject]@{ Text = $plain.ToString(); Spans = $spans }
}

function Add-DocumentParagraph {
    param(
        $Document,
        $Selection,
        [string]$Text,
        [ValidateSet('body', 'heading1', 'heading2', 'bullet', 'number', 'warning', 'metadata')]
        [string]$Kind = 'body'
    )

    $inline = Convert-InlineMarkdown $Text
    $Selection.SetRange($Document.Content.End - 1, $Document.Content.End - 1)
    $Selection.TypeText($inline.Text)
    $Selection.TypeParagraph()
    $paragraph = $Document.Paragraphs.Item($Document.Paragraphs.Count - 1)

    switch ($Kind) {
        'heading1' {
            $paragraph.Range.Style = $Document.Styles.Item(-2)
            $paragraph.Range.Font.Name = 'Montserrat'
            $paragraph.Range.Font.Size = 12
            $paragraph.Range.Font.Bold = $true
            $paragraph.Range.Font.Color = 6957840
            $paragraph.Format.SpaceBefore = 0
            $paragraph.Format.SpaceAfter = 0
            $paragraph.Format.LineSpacingRule = 1
            $paragraph.Format.LineSpacing = 18
            $paragraph.Format.KeepWithNext = $true
        }
        'heading2' {
            $paragraph.Range.Style = $Document.Styles.Item(-3)
            $paragraph.Range.Font.Name = 'Montserrat'
            $paragraph.Range.Font.Size = 12
            $paragraph.Range.Font.Bold = $false
            $paragraph.Range.Font.Color = -16777216
            $paragraph.Format.SpaceBefore = 0
            $paragraph.Format.SpaceAfter = 0
            $paragraph.Format.LineSpacingRule = 1
            $paragraph.Format.LineSpacing = 18
            $paragraph.Format.KeepWithNext = $true
        }
        'warning' {
            $paragraph.Range.Style = $Document.Styles.Item(-1)
            $paragraph.Range.Font.Name = 'Montserrat'
            $paragraph.Range.Font.Size = 12
            $paragraph.Range.Font.Bold = $true
            $paragraph.Range.Font.Color = 26012
            $paragraph.Format.LeftIndent = 21.3
            $paragraph.Format.SpaceBefore = 0
            $paragraph.Format.SpaceAfter = 0
            $paragraph.Format.LineSpacingRule = 1
            $paragraph.Format.LineSpacing = 18
        }
        'metadata' {
            $paragraph.Range.Style = $Document.Styles.Item(-1)
            $paragraph.Range.Font.Name = 'Montserrat'
            $paragraph.Range.Font.Size = 12
            $paragraph.Range.Font.Bold = $false
            $paragraph.Range.Font.Color = 4929060
            $paragraph.Format.SpaceBefore = 0
            $paragraph.Format.SpaceAfter = 0
            $paragraph.Format.LineSpacingRule = 1
            $paragraph.Format.LineSpacing = 18
        }
        default {
            $paragraph.Range.Style = $Document.Styles.Item(-1)
            $paragraph.Range.Font.Name = 'Montserrat'
            $paragraph.Range.Font.Size = 12
            $paragraph.Range.Font.Bold = $false
            $paragraph.Range.Font.Color = if ($Kind -in @('bullet', 'number')) { -16777216 } else { 4929060 }
            $paragraph.Format.SpaceBefore = 0
            $paragraph.Format.SpaceAfter = 0
            $paragraph.Format.LineSpacingRule = 1
            $paragraph.Format.LineSpacing = 18
            if ($Kind -eq 'bullet') {
                $paragraph.Range.Style = $Document.Styles.Item('List Paragraph')
                $paragraph.Range.ListFormat.ApplyListTemplate($script:BulletListTemplate, $true)
                $paragraph.Range.Font.Name = 'Montserrat'
                $paragraph.Range.Font.Size = 12
                $paragraph.Range.Font.Color = -16777216
                $paragraph.Format.LeftIndent = 21.3
                $paragraph.Format.FirstLineIndent = -18
            } elseif ($Kind -eq 'number') {
                $paragraph.Range.ListFormat.ApplyListTemplate($script:NumberListTemplate, $script:NumberListStarted)
                $script:NumberListStarted = $true
                $paragraph.Format.LeftIndent = 31.45
                $paragraph.Format.FirstLineIndent = -18
            }
        }
    }

    foreach ($span in $inline.Spans) {
        $spanRange = $Document.Range($paragraph.Range.Start + $span.Start, $paragraph.Range.Start + $span.Start + $span.Length)
        if ($span.Kind -eq 'bold') {
            $spanRange.Font.Bold = $true
        } else {
            $spanRange.Font.Name = 'Montserrat'
            $spanRange.Font.Size = 11
            $spanRange.Font.Color = 3487029
        }
        Release-ComObject $spanRange
    }

    foreach ($urlMatch in [regex]::Matches($inline.Text, 'https://[^\s)]+')) {
        $urlRange = $Document.Range($paragraph.Range.Start + $urlMatch.Index, $paragraph.Range.Start + $urlMatch.Index + $urlMatch.Length)
        try { [void]$Document.Hyperlinks.Add($urlRange, $urlMatch.Value) } catch {}
        Release-ComObject $urlRange
    }

    Release-ComObject $paragraph
}

function Flush-Block {
    param($Document, $Selection, [ref]$Kind, [ref]$Parts)
    if ($Parts.Value.Count -eq 0) { return }
    $text = ($Parts.Value -join ' ').Trim()
    if ($text) { Add-DocumentParagraph $Document $Selection $text $Kind.Value }
    $Kind.Value = $null
    $Parts.Value = [Collections.Generic.List[string]]::new()
}

$template = (Resolve-Path -LiteralPath $TemplatePath).Path
$markdown = (Resolve-Path -LiteralPath $MarkdownPath).Path
$output = [IO.Path]::GetFullPath((Join-Path (Get-Location) $OutputPath))
$lines = Get-Content -LiteralPath $markdown -Encoding UTF8

$word = $null
$document = $null
try {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0
    $document = $word.Documents.Open($template, $false, $true)
    $document.SaveAs($output, 16)

    Set-ParagraphText $document.Paragraphs.Item(5) 'ДОКУМЕНТАЦИЯ,'
    Set-ParagraphText $document.Paragraphs.Item(6) 'содержащая информацию, необходимую для эксплуатации экземпляра программного обеспечения, предоставленного для проведения экспертной проверки'
    Set-ParagraphText $document.Paragraphs.Item(13) 'Программное обеспечение: «Delomant Analytics System»'
    Set-ParagraphText $document.Paragraphs.Item(14) 'Правообладатель: ООО «ДЕЛОМАНТ ГРУПП»'
    Set-ParagraphText $document.Paragraphs.Item(15) 'Экспертный стенд: https://delomant-analytics-system.ru/'
    Set-ParagraphText $document.Paragraphs.Item(16) 'Версия: 0.9'
    Set-ParagraphText $document.Paragraphs.Item(21) 'Delomant Group'
    Set-ParagraphText $document.Paragraphs.Item(22) 'август 2026'

    foreach ($index in 13..16) {
        $coverParagraph = $document.Paragraphs.Item($index)
        $coverParagraph.Range.Font.Name = 'Montserrat'
        $coverParagraph.Range.Font.Size = 12
        $coverParagraph.Range.Font.Color = 4929060
        $coverParagraph.Format.LineSpacingRule = 1
        $coverParagraph.Format.LineSpacing = 18
        Release-ComObject $coverParagraph
    }

    $coverUrlText = 'https://delomant-analytics-system.ru/'
    $coverUrlParagraph = $document.Paragraphs.Item(15)
    $coverUrlStart = $coverUrlParagraph.Range.Start + $coverUrlParagraph.Range.Text.IndexOf($coverUrlText)
    $coverUrlRange = $document.Range($coverUrlStart, $coverUrlStart + $coverUrlText.Length)
    try { [void]$document.Hyperlinks.Add($coverUrlRange, $coverUrlText) } catch {}
    Release-ComObject $coverUrlRange
    Release-ComObject $coverUrlParagraph

    $script:BulletListTemplate = $document.Paragraphs.Item(31).Range.ListFormat.ListTemplate
    $script:NumberListTemplate = $document.Paragraphs.Item(75).Range.ListFormat.ListTemplate
    $script:NumberListStarted = $false

    $deleteRange = $document.Range($document.Paragraphs.Item(25).Range.Start, $document.Content.End - 1)
    [void]$deleteRange.Delete()
    Release-ComObject $deleteRange

    $selection = $word.Selection

    $startIndex = 0
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^##\s+') { $startIndex = $i; break }
    }

    $blockKind = $null
    $blockParts = [Collections.Generic.List[string]]::new()
    $numberSequenceActive = $false

    for ($i = $startIndex; $i -lt $lines.Count; $i++) {
        $line = $lines[$i]
        if ([string]::IsNullOrWhiteSpace($line)) {
            Flush-Block $document $selection ([ref]$blockKind) ([ref]$blockParts)
            $numberSequenceActive = $false
            continue
        }

        if ($line -match '^##\s+(.+)$') {
            Flush-Block $document $selection ([ref]$blockKind) ([ref]$blockParts)
            $numberSequenceActive = $false
            Add-DocumentParagraph $document $selection $Matches[1] 'heading1'
            continue
        }
        if ($line -match '^###\s+(.+)$') {
            Flush-Block $document $selection ([ref]$blockKind) ([ref]$blockParts)
            $numberSequenceActive = $false
            Add-DocumentParagraph $document $selection $Matches[1] 'heading2'
            continue
        }
        if ($line -match '^-\s+(.+)$') {
            Flush-Block $document $selection ([ref]$blockKind) ([ref]$blockParts)
            $numberSequenceActive = $false
            $blockKind = 'bullet'
            $blockParts.Add($Matches[1])
            continue
        }
        if ($line -match '^\d+\.\s+(.+)$') {
            $continueNumberSequence = ($blockKind -eq 'number') -or $numberSequenceActive
            Flush-Block $document $selection ([ref]$blockKind) ([ref]$blockParts)
            if (-not $continueNumberSequence) { $script:NumberListStarted = $false }
            $numberSequenceActive = $true
            $blockKind = 'number'
            $blockParts.Add($Matches[1])
            continue
        }
        if ($line -match '^>\s?(.*)$') {
            if ($blockKind -ne 'warning') {
                Flush-Block $document $selection ([ref]$blockKind) ([ref]$blockParts)
                $numberSequenceActive = $false
                $blockKind = 'warning'
            }
            $blockParts.Add($Matches[1])
            continue
        }

        if ($null -eq $blockKind) { $blockKind = 'body' }
        $blockParts.Add($line.Trim())
    }
    Flush-Block $document $selection ([ref]$blockKind) ([ref]$blockParts)

    $document.Repaginate()
    for ($index = 25; $index -lt $document.Paragraphs.Count; $index++) {
        $paragraph = $document.Paragraphs.Item($index)
        $styleName = $paragraph.Range.Style.NameLocal
        $paragraphText = ($paragraph.Range.Text -replace '[\r\a]', '').Trim()
        if ($styleName -like 'Заголовок*') {
            $paragraph.Format.KeepWithNext = $true
            $paragraph.Format.KeepTogether = $true
        }
        Release-ComObject $paragraph
    }

    $document.Repaginate()
    for ($index = $document.Paragraphs.Count - 1; $index -ge 25; $index--) {
        $paragraph = $document.Paragraphs.Item($index)
        if ($paragraph.Range.Style.NameLocal -like 'Заголовок*') {
            $nextParagraph = $document.Paragraphs.Item($index + 1)
            if ($paragraph.Range.Information(3) -ne $nextParagraph.Range.Information(3)) {
                $paragraph.Format.PageBreakBefore = $true
            }
            Release-ComObject $nextParagraph
        }
        Release-ComObject $paragraph
    }

    try {
        $document.BuiltInDocumentProperties.Item('Title').Value = 'Информация для эксплуатации экземпляра ПО Delomant 0.9'
        $document.BuiltInDocumentProperties.Item('Subject').Value = 'Документация для проведения экспертной проверки'
        $document.BuiltInDocumentProperties.Item('Author').Value = 'ООО «ДЕЛОМАНТ ГРУПП»'
        $document.BuiltInDocumentProperties.Item('Keywords').Value = 'Delomant, эксплуатация, экспертная проверка'
    } catch {}

    $document.Fields.Update() | Out-Null
    $document.Save()
    Write-Output $output
} finally {
    if ($null -ne $document) {
        try { $document.Close(0) } catch {}
        Release-ComObject $document
    }
    if ($null -ne $word) {
        try { $word.Quit() } catch {}
        Release-ComObject $word
    }
}
